package com.teaching.lms

import android.Manifest
import android.content.Intent
import android.content.pm.PackageManager
import android.database.Cursor
import android.os.Bundle
import android.provider.ContactsContract
import android.view.WindowManager
import androidx.activity.enableEdgeToEdge
import androidx.core.app.ActivityCompat
import androidx.core.content.ContextCompat
import io.flutter.embedding.android.FlutterFragmentActivity
import io.flutter.embedding.engine.FlutterEngine
import io.flutter.plugin.common.MethodChannel

/**
 * Hosts MethodChannels for window security settings and native contact access.
 */
class MainActivity : FlutterFragmentActivity() {
    private var communityFiles: CommunityFilePicker? = null
    private val SECURE_CHANNEL = "com.teaching.lms/secure_window"
    private val CONTACTS_CHANNEL = "com.teaching.lms/contacts"
    private val PERMISSION_REQUEST_CODE = 1002
    private var pendingPermissionResult: MethodChannel.Result? = null

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

        MethodChannel(flutterEngine.dartExecutor.binaryMessenger, CONTACTS_CHANNEL)
            .setMethodCallHandler { call, result ->
                when (call.method) {
                    "hasPermission" -> {
                        val granted = ContextCompat.checkSelfPermission(
                            this,
                            Manifest.permission.READ_CONTACTS
                        ) == PackageManager.PERMISSION_GRANTED
                        result.success(granted)
                    }
                    "requestPermission" -> {
                        val granted = ContextCompat.checkSelfPermission(
                            this,
                            Manifest.permission.READ_CONTACTS
                        ) == PackageManager.PERMISSION_GRANTED
                        if (granted) {
                            result.success(true)
                        } else {
                            pendingPermissionResult = result
                            ActivityCompat.requestPermissions(
                                this,
                                arrayOf(Manifest.permission.READ_CONTACTS),
                                PERMISSION_REQUEST_CODE
                            )
                        }
                    }
                    "getContacts" -> {
                        Thread {
                            try {
                                val contactsList = fetchContacts()
                                runOnUiThread { result.success(contactsList) }
                            } catch (e: Exception) {
                                runOnUiThread { result.error("FETCH_ERROR", e.message, null) }
                            }
                        }.start()
                    }
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

    override fun onRequestPermissionsResult(
        requestCode: Int,
        permissions: Array<out String>,
        grantResults: IntArray
    ) {
        super.onRequestPermissionsResult(requestCode, permissions, grantResults)
        if (requestCode == PERMISSION_REQUEST_CODE) {
            val granted = grantResults.isNotEmpty() && grantResults[0] == PackageManager.PERMISSION_GRANTED
            pendingPermissionResult?.success(granted)
            pendingPermissionResult = null
        }
    }

    private fun fetchContacts(): List<Map<String, String>> {
        val contacts = mutableListOf<Map<String, String>>()
        val seenPhones = mutableSetOf<String>()
        val contentResolver = contentResolver
        val cursor: Cursor? = contentResolver.query(
            ContactsContract.CommonDataKinds.Phone.CONTENT_URI,
            arrayOf(
                ContactsContract.CommonDataKinds.Phone.DISPLAY_NAME,
                ContactsContract.CommonDataKinds.Phone.NUMBER
            ),
            null,
            null,
            ContactsContract.CommonDataKinds.Phone.DISPLAY_NAME + " ASC"
        )

        cursor?.use {
            val nameIndex = it.getColumnIndex(ContactsContract.CommonDataKinds.Phone.DISPLAY_NAME)
            val numberIndex = it.getColumnIndex(ContactsContract.CommonDataKinds.Phone.NUMBER)

            while (it.moveToNext()) {
                val name = if (nameIndex != -1) it.getString(nameIndex) ?: "" else ""
                val number = if (numberIndex != -1) it.getString(numberIndex) ?: "" else ""
                val cleanNumber = number.replace(Regex("[^0-9+]"), "").trim()

                if (cleanNumber.isNotEmpty() && !seenPhones.contains(cleanNumber)) {
                    seenPhones.add(cleanNumber)
                    contacts.add(
                        mapOf(
                            "name" to name.trim(),
                            "phone" to cleanNumber
                        )
                    )
                }
            }
        }
        return contacts
    }
}
