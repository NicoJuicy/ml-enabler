"""Example AWS Lambda function for chip-n-scale"""

from io import StringIO
from shapely.geometry import shape, box
from shapely.ops import transform
from functools import partial
import os, boto3, requests, csv, json, pyproj, mercantile
from tiletanic import tilecover, tileschemes
from typing import Dict, Any
from pop.custom_types import SQSEvent
from contextlib import closing

tiler = tileschemes.WebMercator()

def handler(event: SQSEvent) -> bool:
    queue_name = event['queue']
    assert(queue_name)

    queue = boto3.resource("sqs").get_queue_by_name(QueueName=queue_name)

    fmt = event['fmt']

    if fmt == "list":
        url = event['url']

        with closing(requests.get(url, stream=True)) as r:
            r.raise_for_status()

            r.encoding = 'utf-8'
            reader = csv.reader(r.iter_lines(decode_unicode=True), delimiter=',', quotechar='"')

            cache = []
            total = -1;
            for row in reader:
                if total == -1:
                    total += 1
                    continue

                cache.append({
                    "Id": row[0],
                    "MessageBody": json.dumps({
                        "name": row[0],
                        "url": row[1],
                        "bounds": list(map(lambda x: float(x), row[2].split(",")))
                    }),
                })
                total += 1

                if len(cache) == 10:
                    queue.send_messages(Entries=cache)
                    cache = []

            if len(cache) > 0:
                queue.send_messages(Entries=cache)

        print('ok - {} messages delivered', total)

    elif fmt == "wms":
        payload = event['payload']

        tiles = []
        payloadjson = json.loads(payload)

        if type(payloadjson) is list:
            for tile in payloadjson:
                tile = tile.split("-")
                tiles.append(
                    mercantile.Tile(int(tile[0]), int(tile[1]), int(tile[2]))
                )

        else:
            poly = shape(geojson.loads(payload))

            project = partial(
                pyproj.transform,
                pyproj.Proj(init="epsg:4326"),
                pyproj.Proj(init="epsg:3857"),
            )

            poly = transform(project, poly)

            tiles = tilecover.cover_geometry(tiler, poly, prediction.tile_zoom)

        cache = []
        for tile in tiles:
            cache.append(
                {
                    "Id": str(tile.z) + "-" + str(tile.x) + "-" + str(tile.y),
                    "MessageBody": json.dumps(
                        {
                            "name": "{x}-{y}-{z}".format(
                                x=tile.x, y=tile.y, z=tile.z
                            ),
                            "url": imagery["url"].format(
                                x=tile.x, y=tile.y, z=tile.z
                            ),
                            "bounds": mercantile.bounds(tile.x, tile.y, tile.z),
                            "x": tile.x,
                            "y": tile.y,
                            "z": tile.z,
                        }
                    ),
                }
            )

            if len(cache) == 10:
                queue.send_messages(Entries=cache)

                cache = []

        if len(cache) > 0:
            queue.send_messages(Entries=cache)

    return True

if __name__ == '__main__':
    event = json.loads(os.getenv('TASK'))

    handler(event)

