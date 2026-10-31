plugins {
    id("com.android.application")
    id("org.jetbrains.kotlin.android")
}

// The monitor page is the only web content. It is copied from the repository's
// public/monitor folder at build time, so the APK carries the same files the
// /monitor/ web page serves.
val syncMonitorAssets by tasks.registering(Copy::class) {
    from("../../public/monitor")
    into(layout.buildDirectory.dir("generated/monitor-assets/monitor"))
}

android {
    namespace = "io.aegis.monitor"
    compileSdk = 34

    defaultConfig {
        applicationId = "io.aegis.monitor"
        minSdk = 26
        targetSdk = 34
        versionCode = 1
        versionName = "0.1.0"
    }

    // Release signing reads its secrets from the environment. Nothing about the
    // key is stored in the repository.
    signingConfigs {
        create("release") {
            val path = System.getenv("AEGIS_KEYSTORE_PATH")
            if (path != null) {
                storeFile = file(path)
                storePassword = System.getenv("AEGIS_KEYSTORE_PASSWORD")
                keyAlias = System.getenv("AEGIS_KEY_ALIAS")
                keyPassword = System.getenv("AEGIS_KEY_PASSWORD")
            }
        }
    }

    buildTypes {
        release {
            isMinifyEnabled = false
            if (System.getenv("AEGIS_KEYSTORE_PATH") != null) {
                signingConfig = signingConfigs.getByName("release")
            }
        }
    }

    compileOptions {
        sourceCompatibility = JavaVersion.VERSION_17
        targetCompatibility = JavaVersion.VERSION_17
    }

    kotlinOptions {
        jvmTarget = "17"
    }

    sourceSets {
        getByName("main") {
            assets.srcDirs(layout.buildDirectory.dir("generated/monitor-assets").get().asFile)
        }
    }
}

tasks.named("preBuild") {
    dependsOn(syncMonitorAssets)
}

dependencies {
    // The CSS Labs SDK does the readings, the log and the checks.
    implementation(project(":csslabs-sdk"))
    // WebView asset loading, so pages are served from inside the APK.
    implementation("androidx.webkit:webkit:1.11.0")
    testImplementation("junit:junit:4.13.2")
}
