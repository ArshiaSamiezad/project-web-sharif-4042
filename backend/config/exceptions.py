from rest_framework.views import exception_handler

def api_exception_handler(exc, context):
    response = exception_handler(exc, context)
    if response is not None:
        details = response.data
        error = {"status": response.status_code, "details": details}
        response.data = {**details, "error": error} if isinstance(details, dict) else {"error": error}
    return response
