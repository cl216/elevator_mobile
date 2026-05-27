const { withAndroidManifest } = require("@expo/config-plugins");

module.exports = function withAndroidLaunchMode(config) {
  return withAndroidManifest(config, (config) => {
    const application = config.modResults.manifest.application?.[0];

    if (!application?.activity) {
      return config;
    }

    const mainActivity = application.activity.find(
      (activity) =>
        activity?.$?.["android:name"] === ".MainActivity"
    );

    if (mainActivity?.$) {
      mainActivity.$["android:launchMode"] = "singleTask";
    }

    return config;
  });
};