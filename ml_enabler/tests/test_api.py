import json
from ml_enabler.tests.base import BaseTestCase
from ml_enabler.tests.factories import MLModelFactory
from ml_enabler.tests.fixtures import tiles, geojson
from ml_enabler.tests.utils import create_prediction, create_prediction_tiles


class StatusTest(BaseTestCase):
    def test_status(self):
        response = self.client.get("/")
        assert response.get_json() == {"hello": "world"}


class PredictionAPITest(BaseTestCase):
    def test_no_model(self):
        prediction_payload = {
            "modelId": 1,
            "version": "2.0.0",
            "bbox": [10.013795, 53.5225, 10.048885, 53.540843],
            "tileZoom": 18,
        }
        response = self.client.post(
            "/v1/model/1/prediction",
            data=json.dumps(prediction_payload),
            content_type="application/json",
        )
        assert response.get_json() == {"error": "model not found"}

    def test_post(self):

        # create a model
        ml_model = MLModelFactory(name="this is a test model")
        self.db.session.add(ml_model)
        self.db.session.commit()

        prediction_payload = {
            "modelId": ml_model.id,
            "version": "2.0.0",
            "bbox": [10.013795, 53.5225, 10.048885, 53.540843],
            "tileZoom": 18,
        }
        response = self.client.post(
            f"/v1/model/{ml_model.id}/prediction",
            data=json.dumps(prediction_payload),
            content_type="application/json",
        )
        assert response.get_json() == {"prediction_id": ml_model.id}

    def test_get(self):

        prediction = create_prediction()
        ml_model_id = prediction.model_id

        response = self.client.get(
            f"/v1/model/{ml_model_id}/prediction?"
            "bbox=10.013795,53.5225,"
            "10.048885,53.540843"
        )
        assert len(response.get_json()) == 1


class PredictionTileAPITest(BaseTestCase):
    def test_post(self):

        prediction = create_prediction()
        payload = tiles.tiles_for_prediction(prediction.id)

        response = self.client.post(
            f"/v1/model/prediction/{prediction.id}/tiles",
            data=json.dumps(payload),
            content_type="application/json",
        )
        assert response.status_code == 200

    def test_geojson_post(self):

        prediction = create_prediction()
        create_prediction_tiles(prediction.id)

        payload = geojson.get_geojson()

        response = self.client.post(
            f"/v1/model/{prediction.model_id}/tiles/geojson",
            data=json.dumps(payload),
            content_type="application/json",
        )

        assert response.status_code == 200
        assert len(response.get_json()["features"]) == 3

    def test_get(self):

        prediction = create_prediction()
        create_prediction_tiles(prediction.id)
        response = self.client.get(
            f"/v1/model/{prediction.model_id}/tiles?bbox=10.013795,53.5225,10.048885,53.540843&zoom=18"
        )
        assert response.status_code == 200

    def test_get_outside_bbox(self):

        prediction = create_prediction()
        create_prediction_tiles(prediction.id)
        response = self.client.get(
            f"/v1/model/{prediction.model_id}/tiles?bbox=10.05,53.52,10.08,53.54&zoom=18"
        )
        assert response.get_json() == {"error": "No predictions for this bbox"}
        assert response.status_code == 404
