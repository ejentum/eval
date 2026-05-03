"""
Upsert Eolia menu KB to Qdrant collection 'menu_collection'.
Mirrors the established pattern from upsert_music_collection.py.

- Source: eolia_menu_kb.json
- Embeddings: gemini-embedding-2-preview (3072d), task RETRIEVAL_DOCUMENT
- Distance: Cosine
- Quantization: INT8 scalar (matches other Ejentum collections)
- Payload: page_content (embedding text) + metadata (full item fields)
- UUIDs: deterministic from chunk_id via uuid5(DNS, "ejentum.menu.{chunk_id}")
"""

import json
import os
import sys
import time
import uuid
import requests
from qdrant_client import QdrantClient
from qdrant_client.models import (
    Distance, VectorParams, PointStruct,
    ScalarQuantization, ScalarQuantizationConfig, ScalarType,
    OptimizersConfigDiff,
)

sys.stdout.reconfigure(encoding="utf-8", errors="replace")

QDRANT_URL = os.environ.get("QDRANT_URL", "")
QDRANT_API_KEY = os.environ.get("QDRANT_API_KEY", "")
GEMINI_KEY = os.environ.get("GEMINI_API_KEY", "")
GEMINI_MODEL = "gemini-embedding-2-preview"
COLLECTION = "menu_collection"
KB_PATH = os.path.join(os.path.dirname(os.path.abspath(__file__)), "menu_kb.json")

if not (QDRANT_URL and QDRANT_API_KEY and GEMINI_KEY):
    raise SystemExit(
        "Set QDRANT_URL, QDRANT_API_KEY, and GEMINI_API_KEY in your environment "
        "before running. QDRANT_URL is your cluster endpoint from Qdrant Cloud; "
        "GEMINI_API_KEY is from https://aistudio.google.com/app/apikey."
    )


def embed_text(text, task_type="RETRIEVAL_DOCUMENT", retries=3):
    url = f"https://generativelanguage.googleapis.com/v1beta/models/{GEMINI_MODEL}:embedContent?key={GEMINI_KEY}"
    for attempt in range(retries):
        try:
            resp = requests.post(url, json={
                "model": f"models/{GEMINI_MODEL}",
                "content": {"parts": [{"text": text}]},
                "taskType": task_type,
            }, timeout=30)
            if resp.status_code == 200:
                return resp.json()["embedding"]["values"]
            elif resp.status_code == 429:
                wait = 10 * (attempt + 1)
                print(f"  RATE LIMITED, waiting {wait}s (attempt {attempt+1}/{retries})", flush=True)
                time.sleep(wait)
            else:
                print(f"  EMBED ERROR {resp.status_code}: {resp.text[:200]}", flush=True)
                return None
        except (requests.exceptions.SSLError, requests.exceptions.ConnectionError) as e:
            wait = 5 * (attempt + 1)
            print(f"  SSL/CONN ERROR, waiting {wait}s (attempt {attempt+1}/{retries})", flush=True)
            time.sleep(wait)
    return None


def build_embedding_text(item, restaurant_name):
    """Concatenate all relevant fields into embedding text. Ensures semantic search surfaces ingredients, pairings, and disclaimers."""
    parts = []
    parts.append(f"{item['name']} ({item['category']})")
    if item.get("description"):
        parts.append(item["description"])
    if item.get("ingredients"):
        parts.append(f"Ingredients: {item['ingredients']}")
    if item.get("wine_pairing"):
        parts.append(f"Wine pairing: {item['wine_pairing']}")
    if item.get("spice_level"):
        parts.append(f"Spice level: {item['spice_level']}")
    if item.get("region"):
        parts.append(f"Region: {item['region']}")
    if item.get("varietal"):
        parts.append(f"Varietal: {item['varietal']}")
    if item.get("vintage"):
        parts.append(f"Vintage: {item['vintage']}")
    if item.get("price"):
        parts.append(f"Price: ${item['price']}")
    if item.get("price_glass"):
        parts.append(f"Glass: ${item['price_glass']}")
    if item.get("price_bottle"):
        parts.append(f"Bottle: ${item['price_bottle']}")
    if item.get("price_half_bottle"):
        parts.append(f"Half-bottle: ${item['price_half_bottle']}")
    parts.append(f"From the menu of {restaurant_name}.")
    return ". ".join(parts) + "."


# Load KB
with open(KB_PATH, encoding="utf-8") as f:
    kb = json.load(f)

restaurant_name = kb["restaurant"]["name"]
items = kb["items"]
print(f"Loaded {len(items)} chunks from {os.path.basename(KB_PATH)}", flush=True)
print(f"Restaurant: {restaurant_name}", flush=True)

# Connect to Qdrant
client = QdrantClient(url=QDRANT_URL, api_key=QDRANT_API_KEY, timeout=60)
print(f"Connected to Qdrant", flush=True)

# Recreate collection
existing = [c.name for c in client.get_collections().collections]
if COLLECTION in existing:
    print(f"Collection '{COLLECTION}' exists. Deleting and recreating.", flush=True)
    client.delete_collection(COLLECTION)
    time.sleep(1)

client.create_collection(
    collection_name=COLLECTION,
    vectors_config=VectorParams(size=3072, distance=Distance.COSINE),
    quantization_config=ScalarQuantization(
        scalar=ScalarQuantizationConfig(type=ScalarType.INT8, always_ram=True)
    ),
    optimizers_config=OptimizersConfigDiff(indexing_threshold=10000),
)
print(f"Created '{COLLECTION}' (3072d, Cosine, INT8)", flush=True)

# Embed and build points
points = []
errors = 0

for i, item in enumerate(items):
    cid = item["chunk_id"]
    embedding_text = build_embedding_text(item, restaurant_name)

    embedding = embed_text(embedding_text)
    if embedding is None:
        print(f"  [{i+1}/{len(items)}] {cid} FAILED, retrying once", flush=True)
        time.sleep(2)
        embedding = embed_text(embedding_text)
        if embedding is None:
            print(f"  [{i+1}/{len(items)}] {cid} RETRY FAILED, skipping", flush=True)
            errors += 1
            continue

    point_id = str(uuid.uuid5(uuid.NAMESPACE_DNS, f"ejentum.menu.{cid}"))

    points.append(PointStruct(
        id=point_id,
        vector=embedding,
        payload={
            "page_content": embedding_text,
            "metadata": item,
        }
    ))

    print(f"  [{i+1}/{len(items)}] {cid} {item['name'][:50]} ({len(embedding)}d)", flush=True)

    if (i + 1) % 10 == 0:
        time.sleep(3)
    else:
        time.sleep(0.8)

# Upsert in batches
print(f"\nUpserting {len(points)} points to '{COLLECTION}'", flush=True)
if points:
    batch_size = 10
    for batch_start in range(0, len(points), batch_size):
        batch = points[batch_start:batch_start + batch_size]
        try:
            client.upsert(collection_name=COLLECTION, points=batch, timeout=120)
            print(f"  Batch {batch_start//batch_size + 1}: upserted {len(batch)}", flush=True)
        except Exception as e:
            print(f"  Batch {batch_start//batch_size + 1} failed: {e}", flush=True)
            for p in batch:
                try:
                    client.upsert(collection_name=COLLECTION, points=[p], timeout=60)
                except Exception as e2:
                    cid = p.payload["metadata"]["chunk_id"]
                    print(f"    Point {cid} FAILED: {e2}", flush=True)
                    errors += 1
        time.sleep(0.4)

# Verify
info = client.get_collection(COLLECTION)
print(f"\n{'='*60}")
print(f"UPSERT COMPLETE: menu_collection")
print(f"{'='*60}")
print(f"  Collection: {COLLECTION}")
print(f"  Points: {info.points_count}")
print(f"  Expected: {len(items)}")
print(f"  Vectors: 3072d Cosine INT8")
print(f"  Status: {info.status}")
print(f"  Errors: {errors}")
print(f"  UUID namespace: ejentum.menu.{{chunk_id}}")
print(f"{'='*60}")
