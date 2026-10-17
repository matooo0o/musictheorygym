# Theory Gym APK

Option A (no installs): upload these files to a new GitHub repo. Then use Add file > Create new file, name it .github/workflows/build-apk.yml (typing the slashes creates the folders) and paste in the contents of build-apk.yml. Open the Actions tab,
run "Build APK", then download "theory-gym-apk" (app-debug.apk) from the run page.
Copy it to your phone and open it (allow "install unknown apps" when asked).

Option B (local): install Node 20, JDK 17 and Android Studio, then run:
npm install && npx cap add android && npx cap sync android && cd android && ./gradlew assembleDebug
