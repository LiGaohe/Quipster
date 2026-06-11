import type { ScreenwrightConfig } from 'screenwright';

const config: ScreenwrightConfig = {
  "piperVoice": "zh_CN-huayan-low",
  "resolution": {
    "width": 1280,
    "height": 720
  },
  "outputDir": "./output",
  "locale": "en-US",
  "colorScheme": "light",
  "timezoneId": "America/New_York",
  "ttsProvider": "piper",
  "openaiVoice": "nova",
  "openaiTtsInstructions": "Speak in an upbeat, enthusiastic tone. This is a tech product demo video. Be energetic and professional, like a friendly product evangelist."
};

export default config;
