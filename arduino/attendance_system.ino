/*
 * Arduino Uno R4 WiFi - Attendance System
 * Integrates with Supabase backend for RFID-based attendance
 */

#include <WiFi.h>
#include <HTTPClient.h>
#include <ArduinoJson.h>
#include <SPI.h>
#include <MFRC522.h>
#include <SoftwareSerial.h>
#include <TinyGPS++.h>

// WiFi Configuration
const char* ssid = "YOUR_WIFI_SSID";        // Replace with your WiFi SSID
const char* password = "YOUR_WIFI_PASSWORD"; // Replace with your WiFi password

// Supabase Configuration
const String SUPABASE_URL = "https://epvggkmzbuudajceuaib.supabase.co";
const String ESP32_DEVICE_ID = "arduino_uno_r4_001"; // Unique identifier for this device

// Pin Configuration
#define RST_PIN         9
#define SS_PIN          10
#define BUZZER_PIN      8
#define LED_GREEN_PIN   7
#define LED_RED_PIN     6
#define GPS_RX_PIN      4
#define GPS_TX_PIN      5

// Component Initialization
MFRC522 mfrc522(SS_PIN, RST_PIN);
SoftwareSerial ss(GPS_RX_PIN, GPS_TX_PIN);
TinyGPSPlus gps;

// Global Variables
float currentLatitude = 0.0;
float currentLongitude = 0.0;
bool gpsFixed = false;
unsigned long lastRFIDRead = 0;
const unsigned long RFID_COOLDOWN = 3000; // 3 seconds between readings

void setup() {
  Serial.begin(115200);
  ss.begin(9600);
  SPI.begin();
  mfrc522.PCD_Init();
  
  // Initialize pins
  pinMode(BUZZER_PIN, OUTPUT);
  pinMode(LED_GREEN_PIN, OUTPUT);
  pinMode(LED_RED_PIN, OUTPUT);
  
  // LED startup sequence
  digitalWrite(LED_RED_PIN, HIGH);
  delay(500);
  digitalWrite(LED_RED_PIN, LOW);
  
  Serial.println("\n=== Arduino Uno R4 WiFi Attendance System ===");
  Serial.println("Initializing...");
  
  // Connect to WiFi
  connectToWiFi();
  
  // Initialize GPS
  Serial.println("Initializing GPS...");
  Serial.println("Waiting for GPS fix...");
  
  Serial.println("System Ready!");
  Serial.println("Present RFID card to reader...");
  
  // Success indicator
  digitalWrite(LED_GREEN_PIN, HIGH);
  delay(1000);
  digitalWrite(LED_GREEN_PIN, LOW);
}

void loop() {
  // Update GPS data
  updateGPS();
  
  // Check for RFID cards
  if (mfrc522.PICC_IsNewCardPresent() && mfrc522.PICC_ReadCardSerial()) {
    // Prevent rapid multiple readings
    if (millis() - lastRFIDRead > RFID_COOLDOWN) {
      handleRFIDCard();
      lastRFIDRead = millis();
    }
    mfrc522.PICC_HaltA();
    mfrc522.PCD_StopCrypto1();
  }
  
  delay(100);
}

void connectToWiFi() {
  WiFi.begin(ssid, password);
  Serial.print("Connecting to WiFi");
  
  int attempts = 0;
  while (WiFi.status() != WL_CONNECTED && attempts < 30) {
    delay(500);
    Serial.print(".");
    attempts++;
  }
  
  if (WiFi.status() == WL_CONNECTED) {
    Serial.println("\nWiFi Connected!");
    Serial.print("IP Address: ");
    Serial.println(WiFi.localIP());
  } else {
    Serial.println("\nWiFi Connection Failed!");
    // Flash red LED for error
    for (int i = 0; i < 5; i++) {
      digitalWrite(LED_RED_PIN, HIGH);
      delay(200);
      digitalWrite(LED_RED_PIN, LOW);
      delay(200);
    }
  }
}

void updateGPS() {
  while (ss.available() > 0) {
    if (gps.encode(ss.read())) {
      if (gps.location.isValid()) {
        currentLatitude = gps.location.lat();
        currentLongitude = gps.location.lng();
        
        if (!gpsFixed) {
          gpsFixed = true;
          Serial.println("GPS Fix Acquired!");
          Serial.print("Location: ");
          Serial.print(currentLatitude, 6);
          Serial.print(", ");
          Serial.println(currentLongitude, 6);
          
          // GPS fix indicator - quick green blink
          digitalWrite(LED_GREEN_PIN, HIGH);
          delay(100);
          digitalWrite(LED_GREEN_PIN, LOW);
        }
      }
    }
  }
}

void handleRFIDCard() {
  // Read RFID UID
  String rfidUID = "";
  for (byte i = 0; i < mfrc522.uid.size; i++) {
    rfidUID += String(mfrc522.uid.uidByte[i], HEX);
  }
  rfidUID.toUpperCase();
  
  Serial.println("\n--- RFID Card Detected ---");
  Serial.print("Card UID: ");
  Serial.println(rfidUID);
  
  // Visual feedback
  digitalWrite(LED_GREEN_PIN, HIGH);
  tone(BUZZER_PIN, 1000, 200);
  
  // Check GPS status
  if (!gpsFixed) {
    Serial.println("Warning: No GPS fix available, using last known location");
    digitalWrite(LED_RED_PIN, HIGH);
    delay(500);
    digitalWrite(LED_RED_PIN, LOW);
  }
  
  // Send to backend
  if (WiFi.status() == WL_CONNECTED) {
    sendAttendanceData(rfidUID, currentLatitude, currentLongitude);
  } else {
    Serial.println("Error: No WiFi connection");
    signalError();
  }
  
  digitalWrite(LED_GREEN_PIN, LOW);
}

void sendAttendanceData(String studentRFID, float latitude, float longitude) {
  HTTPClient http;
  String endpoint = SUPABASE_URL + "/functions/v1/esp32-rfid-checkin";
  
  http.begin(endpoint);
  http.addHeader("Content-Type", "application/json");
  
  // Create JSON payload
  DynamicJsonDocument doc(1024);
  doc["esp32_device_id"] = ESP32_DEVICE_ID;
  doc["student_rfid"] = studentRFID;
  doc["latitude"] = latitude;
  doc["longitude"] = longitude;
  
  String jsonString;
  serializeJson(doc, jsonString);
  
  Serial.println("Sending attendance data...");
  Serial.print("Endpoint: ");
  Serial.println(endpoint);
  Serial.print("Payload: ");
  Serial.println(jsonString);
  
  int httpResponseCode = http.POST(jsonString);
  
  if (httpResponseCode > 0) {
    String response = http.getString();
    Serial.print("HTTP Response Code: ");
    Serial.println(httpResponseCode);
    Serial.print("Response: ");
    Serial.println(response);
    
    // Parse response
    DynamicJsonDocument responseDoc(2048);
    deserializeJson(responseDoc, response);
    
    if (responseDoc["success"].as<bool>()) {
      Serial.println("✅ Attendance data sent successfully!");
      
      String studentName = responseDoc["student_name"].as<String>();
      String sessionName = responseDoc["session"].as<String>();
      String verificationUrl = responseDoc["verification_url"].as<String>();
      
      Serial.println("--- SUCCESS ---");
      Serial.print("Student: ");
      Serial.println(studentName);
      Serial.print("Session: ");
      Serial.println(sessionName);
      Serial.print("Verification URL: ");
      Serial.println(verificationUrl);
      Serial.println("Student should tap the verification link on their phone!");
      
      signalSuccess();
    } else {
      String error = responseDoc["error"].as<String>();
      Serial.print("❌ Backend Error: ");
      Serial.println(error);
      signalError();
    }
  } else {
    Serial.print("❌ HTTP Error: ");
    Serial.println(httpResponseCode);
    signalError();
  }
  
  http.end();
}

void signalSuccess() {
  // Success pattern: 3 short green blinks + happy tune
  for (int i = 0; i < 3; i++) {
    digitalWrite(LED_GREEN_PIN, HIGH);
    tone(BUZZER_PIN, 1500, 100);
    delay(150);
    digitalWrite(LED_GREEN_PIN, LOW);
    delay(100);
  }
  
  // Happy tune
  tone(BUZZER_PIN, 1000, 100);
  delay(120);
  tone(BUZZER_PIN, 1200, 100);
  delay(120);
  tone(BUZZER_PIN, 1500, 200);
}

void signalError() {
  // Error pattern: 3 long red blinks + error tone
  for (int i = 0; i < 3; i++) {
    digitalWrite(LED_RED_PIN, HIGH);
    tone(BUZZER_PIN, 300, 300);
    delay(400);
    digitalWrite(LED_RED_PIN, LOW);
    delay(200);
  }
}

void printSystemStatus() {
  Serial.println("\n=== System Status ===");
  Serial.print("WiFi: ");
  Serial.println(WiFi.status() == WL_CONNECTED ? "Connected" : "Disconnected");
  Serial.print("GPS: ");
  Serial.println(gpsFixed ? "Fixed" : "No Fix");
  if (gpsFixed) {
    Serial.print("Location: ");
    Serial.print(currentLatitude, 6);
    Serial.print(", ");
    Serial.println(currentLongitude, 6);
  }
  Serial.print("Device ID: ");
  Serial.println(ESP32_DEVICE_ID);
  Serial.println("====================\n");
}

// Add this function to be called from Serial Monitor for debugging
void serialEvent() {
  if (Serial.available()) {
    String command = Serial.readString();
    command.trim();
    
    if (command == "status") {
      printSystemStatus();
    } else if (command == "test") {
      Serial.println("Testing with dummy RFID...");
      sendAttendanceData("TEST123456", currentLatitude, currentLongitude);
    } else if (command == "gps") {
      Serial.print("Current GPS: ");
      Serial.print(currentLatitude, 6);
      Serial.print(", ");
      Serial.println(currentLongitude, 6);
    }
  }
}