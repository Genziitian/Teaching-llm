import 'package:dio/dio.dart';

import '../../config/api_config.dart';
import '../auth/token_storage.dart';

/// Thin Dio wrapper that:
///  - prefixes every request with [ApiConfig.baseUrl]
///  - attaches the JWT as Authorization: Bearer <token> on every call
///  - times out if the network is slow
///  - throws DioException on non-2xx so callers can catch with try/catch
class ApiClient {
  ApiClient({Dio? dio, TokenStorage? tokenStorage})
      : _dio = dio ?? Dio(),
        _tokens = tokenStorage ?? const TokenStorage() {
    _dio
      ..options.baseUrl = ApiConfig.baseUrl
      ..options.connectTimeout = ApiConfig.connectTimeout
      ..options.receiveTimeout = ApiConfig.receiveTimeout
      ..options.responseType = ResponseType.json
      ..options.headers['Accept'] = 'application/json'
      // The Next.js middleware checks for the exact value 'XMLHttpRequest'
      // as a simple CSRF defence (src/middleware.ts:102). Browsers block
      // cross-origin JS from setting custom headers, so requiring this
      // sentinel keeps CSRF off web write-routes. Native HTTP clients can
      // set it freely. Without this we get 403 "missing required header".
      ..options.headers['X-Requested-With'] = 'XMLHttpRequest';

    _dio.interceptors.add(InterceptorsWrapper(
      onRequest: (options, handler) async {
        final token = await _tokens.read();
        if (token != null && token.isNotEmpty) {
          options.headers['Authorization'] = 'Bearer $token';
        }
        handler.next(options);
      },
      onError: (err, handler) async {
        final statusCode = err.response?.statusCode;
        if (statusCode == 401) {
          final path = err.requestOptions.path;
          if (!path.contains('/api/auth/google') &&
              !path.contains('/api/auth/dev-login') &&
              !path.contains('/api/auth/student-quick-login')) {
            await _tokens.clear();
          }
        }

        // Surface the server's `{ "error": "..." }` payload as the exception
        // message so UI snackbars don't have to dig into err.response.data.
        final data = err.response?.data;
        if (data is Map && data['error'] is String) {
          handler.next(DioException(
            requestOptions: err.requestOptions,
            response: err.response,
            type: err.type,
            error: data['error'],
            message: data['error'] as String,
          ));
        } else {
          handler.next(err);
        }
      },
    ));
  }

  final Dio _dio;
  final TokenStorage _tokens;

  Future<Response<T>> get<T>(String path,
          {Map<String, dynamic>? query}) =>
      _dio.get<T>(path, queryParameters: query);

  Future<Response<T>> post<T>(String path, {Object? body}) =>
      _dio.post<T>(path, data: body);

  Future<Response<T>> put<T>(String path, {Object? body}) =>
      _dio.put<T>(path, data: body);

  Future<Response<T>> patch<T>(String path, {Object? body}) =>
      _dio.patch<T>(path, data: body);

  Future<Response<T>> delete<T>(String path, {Object? body}) =>
      _dio.delete<T>(path, data: body);
}
