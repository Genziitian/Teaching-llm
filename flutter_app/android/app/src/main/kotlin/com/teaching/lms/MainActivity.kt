package com.teaching.lms

import android.content.Intent
import android.os.Bundle
import android.view.WindowManager
import androidx.activity.enableEdgeToEdge
import io.flutter.embedding.android.FlutterFragmentActivity
import io.flutter.embedding.engine.FlutterEngine
import io.flutter.plugin.common.MethodChannel

/**
 * Hosts MethodChannels for window security settings.
 */
class MainActivity : FlutterFragmentActivity() {
    private var communityFiles: CommunityFilePicker? = null
    private val SECURE_CHANNEL = "com.teaching.lms/secure_window"

    override fun onCreate(savedInstanceState: Bundle?) {
        enableEdgeToEdge()
        super.onCreate(savedInstanceState)
    }

    override fun configureFlutterEngine(flutterEngine: FlutterEngine) {
        super.configureFlutterEngine(flutterEngine)
        communityFiles = CommunityFilePicker(this, flutterEngine.dartExecutor.binaryMessenger)
        window.clearFlags(WindowManager.LayoutParams.FLAG_SECURE)

        MethodChannel(flutterEngine.dartExecutor.binaryMessenger, SECURE_CHANNEL)
            .setMethodCallHandler { call, result ->
                when (call.method) {
                    "enable" -> result.success(true)
                    "disable" -> {
                        runOnUiThread {
                            window.clearFlags(WindowManager.LayoutParams.FLAG_SECURE)
                        }
                        result.success(true)
                    }
                    else -> result.notImplemented()
                }
            }


        // Device details for login activity / new-device alerts (lib/core/api/device_info.dart).
        MethodChannel(flutterEngine.dartExecutor.binaryMessenger, "com.teaching.lms/device")
            .setMethodCallHandler { call, result ->
                if (call.method != "info") return@setMethodCallHandler result.notImplemented()
                val maker = android.os.Build.MANUFACTURER.replaceFirstChar { it.uppercase() }
                val model = android.os.Build.MODEL
                val version = try { packageManager.getPackageInfo(packageName, 0).versionName } catch (_: Exception) { null }
                result.success(mapOf(
                    "name" to if (model.startsWith(maker, ignoreCase = true)) model else "$maker $model",
                    "os" to "Android ${android.os.Build.VERSION.RELEASE}",
                    "appVersion" to version,
                ))
            }

        MethodChannel(flutterEngine.dartExecutor.binaryMessenger, "com.teaching.lms/screen_share")
            .setMethodCallHandler { call, result ->
                val intent = Intent(this, ScreenShareService::class.java)
                when (call.method) {
                    "start" -> {
                        if (android.os.Build.VERSION.SDK_INT >= android.os.Build.VERSION_CODES.O) startForegroundService(intent) else startService(intent)
                        result.success(true)
                    }
                    "stop" -> { stopService(intent); result.success(true) }
                    else -> result.notImplemented()
                }
            }
    }

    override fun onActivityResult(requestCode: Int, resultCode: Int, data: Intent?) {
        if (communityFiles?.onActivityResult(requestCode, resultCode, data) == true) return
        super.onActivityResult(requestCode, resultCode, data)
    }

    override fun onDestroy() {
        communityFiles?.dispose()
        super.onDestroy()
    }
}
