import 'package:dio/dio.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:google_sign_in_platform_interface/google_sign_in_platform_interface.dart';
import 'package:teaching_llm/config/api_config.dart';
import 'package:teaching_llm/core/api/api_client.dart';
import 'package:teaching_llm/core/auth/auth_service.dart';
import 'package:teaching_llm/core/auth/token_storage.dart';
import 'package:teaching_llm/core/models/user.dart';

class _Google extends GoogleSignInPlatform {
  int initializations = 0;
  bool restoreAccount = true;
  bool cancel = false;
  String? idToken = 'google-id-token';

  AuthenticationResults get result => AuthenticationResults(
    user: const GoogleSignInUserData(id: 'google-user', email: 'user@test.in'),
    authenticationTokens: AuthenticationTokenData(idToken: idToken),
  );

  @override
  Future<void> init(InitParameters params) async {
    initializations++;
    expect(params.serverClientId, ApiConfig.googleWebClientId);
  }

  @override
  Future<AuthenticationResults?> attemptLightweightAuthentication(
    AttemptLightweightAuthenticationParameters params,
  ) async => restoreAccount ? result : null;

  @override
  Future<AuthenticationResults> authenticate(
    AuthenticateParameters params,
  ) async {
    expect(params.scopeHint, ['email', 'profile']);
    if (cancel) {
      throw const GoogleSignInException(
        code: GoogleSignInExceptionCode.canceled,
      );
    }
    return result;
  }

  @override
  dynamic noSuchMethod(Invocation invocation) => super.noSuchMethod(invocation);
}

class _Api extends ApiClient {
  int exchanges = 0;

  static const user = {
    'id': 'user',
    'email': 'user@test.in',
    'role': 'STUDENT',
  };

  @override
  Future<Response<T>> post<T>(String path, {Object? body}) async {
    expect(path, '/api/auth/google');
    expect(body, {'credential': 'google-id-token'});
    exchanges++;
    return Response<T>(
      requestOptions: RequestOptions(path: path),
      data: {'token': 'backend-token', 'user': user} as T,
    );
  }

  @override
  Future<Response<T>> get<T>(
    String path, {
    Map<String, dynamic>? query,
  }) async => Response<T>(
    requestOptions: RequestOptions(path: path),
    data: {
      'user': {...user, 'name': 'Fresh profile'},
    } as T,
  );
}

class _Tokens extends TokenStorage {
  String? savedToken;
  User? savedUser;

  @override
  Future<void> save({
    required String token,
    required String userId,
    required String role,
    User? user,
  }) async => savedToken = token;

  @override
  Future<void> saveUser(User user) async => savedUser = user;
}

void main() {
  TestWidgetsFlutterBinding.ensureInitialized();

  test(
    'Google 7 initializes once, exchanges ID tokens, and preserves failures',
    () async {
      final previous = GoogleSignInPlatform.instance;
      final google = _Google();
      GoogleSignInPlatform.instance = google;
      addTearDown(() => GoogleSignInPlatform.instance = previous);
      final api = _Api();
      final tokens = _Tokens();
      final service = AuthService(api: api, tokens: tokens);

      expect((await service.signInWithGoogle()).name, 'Fresh profile');
      expect(tokens.savedToken, 'backend-token');
      expect(tokens.savedUser?.name, 'Fresh profile');
      google.restoreAccount = false;
      await service.signInWithGoogle();
      expect(api.exchanges, 2);
      expect(google.initializations, 1);

      google.cancel = true;
      await expectLater(
        service.signInWithGoogle(),
        throwsA(
          isA<AuthException>().having(
            (e) => e.message,
            'message',
            'Sign-in was cancelled.',
          ),
        ),
      );
      google.cancel = false;
      google.idToken = null;
      await expectLater(
        service.signInWithGoogle(),
        throwsA(
          isA<AuthException>().having(
            (e) => e.message,
            'message',
            'Google did not return an ID token.',
          ),
        ),
      );
      expect(api.exchanges, 2);
    },
  );
}
