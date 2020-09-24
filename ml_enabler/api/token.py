from flask import Blueprint, session
from flask_restful import request, current_app
from ml_enabler.utils import err
from ml_enabler.models.utils import NotFound
import ml_enabler.config as CONFIG
from flask_login import login_required
from ml_enabler.services.token_service import TokenService
from flask import jsonify
from flask_login import current_user

token_bp = Blueprint(
    'token_bp', __name__
)

@login_required
@token_bp.route('/v1/user/token', methods=['GET'])
def list():
    try:
        tokens = TokenService.list(current_user.id)
        return jsonify(tokens), 200
    except Exception as e:
        error_msg = f'Unhandled error: {str(e)}'
        current_app.logger.error(error_msg)
        return err(500, error_msg), 500

@login_required
@token_bp.route('/v1/user/token', methods=['POST'])
def post():
    try:
        token_payload = request.get_json();
        token_payload['uid'] = current_user.id
        return TokenService.create(token_payload), 200
    except Exception as e:
        error_msg = f'Unhandled error: {str(e)}'
        current_app.logger.error(error_msg)
        return err(500, error_msg), 500

@login_required
@token_bp.route('/v1/user/token/<int:token_id>', methods=['GET'])
def get(token_id):
    try:
        return TokenService.get(current_user.id, token_id)
    except NotFound:
        return err(404, "No Token Found"), 404
    except Exception as e:
        error_msg = f'Unhandled error: {str(e)}'
        current_app.logger.error(error_msg)
        return err(500, error_msg), 500

@login_required
@token_bp.route('/v1/user/token/<int:token_id>', methods=['DELETE'])
def delete(token_id):
    try:
        return TokenService.delete(current_user.id, token_id)
    except NotFound:
        return err(404, "No Token Found"), 404
    except Exception as e:
        error_msg = f'Unhandled error: {str(e)}'
        current_app.logger.error(error_msg)
        return err(500, error_msg), 500
