plugins {
    id("com.android.library")
    id("org.jetbrains.kotlin.android")
}

// The CSS Labs Android SDK. No dependencies: it uses only the Android framework
// and the Kotlin standard library, and it sends nothing off the device.
android {
    namespace = "io.csslabs.sdk"
    compileSdk = 34

    defaultConfig {
        minSdk = 26
        consumerProguardFiles()
    }

    compileOptions {
        sourceCompatibility = JavaVersion.VERSION_17
        targetCompatibility = JavaVersion.VERSION_17
    }

    kotlinOptions {
        jvmTarget = "17"
    }
}

dependencies {
    testImplementation("junit:junit:4.13.2")
}
