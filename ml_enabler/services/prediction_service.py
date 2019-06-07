from flask import current_app
from ml_enabler.models.ml_model import MLModel, MLModelVersion, Prediction
from ml_enabler.models.dtos.ml_model_dto import MLModelDTO, MLModelVersionDTO, PredictionDTO
from ml_enabler.models.utils import NotFound, VersionNotFound, version_to_array, bbox_str_to_list, PredictionsNotFound, geojson_to_bbox
from sqlalchemy.orm.exc import NoResultFound
from mercantile import tiles


class PredictionService():
    @staticmethod
    def create(model_id: int, version_id: int, payload: dict) -> int:
        """
        Validate and add predictions from a model to the database
        :params model_id, version_id, payload

        :raises DataError
        :returns ID of the prediction
        """

        prediction_dto = PredictionDTO()
        prediction_dto.model_id = model_id
        prediction_dto.version_id = version_id
        prediction_dto.bbox = payload['bbox']
        prediction_dto.tile_zoom = payload['tileZoom']
        prediction_dto.validate()

        new_prediction = Prediction()
        new_prediction.create(prediction_dto)
        return new_prediction.id

    @staticmethod
    def get(model_id: int, bbox: list):
        """
        Fetch latest predictions from a model for the given bbox
        :params model_id, bbox

        :raises PredictionsNotFound
        :returns predictions
        """

        boundingBox = bbox_str_to_list(bbox)
        predictions = Prediction.get_predictions_in_bbox(model_id, boundingBox)

        if (len(predictions) == 0):
            raise PredictionsNotFound('Predictions not found')

        data = []
        for prediction in predictions:
            prediction_dto = PredictionDTO()
            version = MLModelVersion.get(prediction[6])
            version_dto = version.as_dto()

            prediction_dto.prediction_id = prediction[0]
            prediction_dto.created = prediction[1]
            prediction_dto.dockerhub_hash = prediction[2]
            prediction_dto.bbox = geojson_to_bbox(prediction[3])
            prediction_dto.model_id = prediction[4]
            prediction_dto.tile_zoom = prediction[5]
            prediction_dto.version_id = prediction[6]
            prediction_dto.version_string = f'{version_dto.version_major}.{version_dto.version_minor}.{version_dto.version_patch}'

            data.append(prediction_dto.to_primitive())

        return data
        # for prediction in prediction_ids:
        #     print(prediction.id, prediction.tile_zoom)
        #     bboxTiles = tiles(boundingBox[0], boundingBox[1], boundingBox[2], boundingBox[3], prediction.tile_zoom)
        #     Prediction.get_prediction_tiles(prediction.id, bboxTiles)
            # for tile in bboxTiles:
            #     print(tile.x)
