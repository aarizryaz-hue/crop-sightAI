# CropSight demo

`CropSight-demo.mp4` is an English narrated screen recording of the local app. The browser sends real requests to the configured OpenAI API. Request waiting time is shortened in the edit and labeled. No app results are replaced or fabricated. Synthetic narration uses the macOS Samantha voice.

`CropSight-demo.srt` contains timed narration captions. The video also has burned-in step captions.

## Source photo

Photo: **Fructibus, “Blossom end rot tomato 2017 A.jpg,” 5 October 2017**.
Source: https://commons.wikimedia.org/wiki/File:Blossom_end_rot_tomato_2017_A.jpg
Original: https://upload.wikimedia.org/wikipedia/commons/1/12/Blossom_end_rot_tomato_2017_A.jpg
License: https://creativecommons.org/publicdomain/zero/1.0/
The photographer released this photo under CC0. The original is saved as `source/tomato-photo.jpg`. The app resizes it for analysis. The source title/description is not sent to the model. It is an external demonstration photo, not a user trial or accuracy benchmark.

An earlier live test with Siltloam's public-domain unripe-fruit photo returned Unknown, incorrectly treated unripe fruit as outside Harvest mode, and gave no possible causes or follow-up. Harvest guidance was clarified in code after that finding. That change needs a server restart; see `source/server-info.json` for the build actually recorded. The selected demo photo does not establish general accuracy or prove the unripe-fruit issue resolved.

**Review cut, not a validated success case:** the recorded ripe-fruit response describes a dark spot but incorrectly reassures that the tomato looks healthy and suggests considering harvesting. The narration explicitly calls out that inconsistency and says it does not authorize harvesting. It does not claim a successful diagnosis or show a follow-up that the model did not return. The analysis prompt has been tightened in code, but those changes have not been tested with the live provider until the server is restarted. Re-record and review before presenting a polished success case to judges.

## Reproduce

Start CropSight with a working server-side API key. Run `node demo/source/record.cjs`, then `python3 demo/source/edit.py`. The recorder uses installed Chrome and Playwright; set `PLAYWRIGHT_PATH` if needed. The editor needs macOS `say` and ffmpeg; set `FFMPEG` to its executable. Raw footage and intermediate files go to `/tmp/cropsight-recording` (override with `DEMO_WORK_DIR`). Recording makes paid API calls on the configured account.

Review and update the narration for each new recording: the model is nondeterministic, and this cut's limitation commentary describes this specific live result.

The Play Store release remains pending a public HTTPS deployment, publisher setup, Android signing and Google Play review. The video must not be presented as evidence of a published Play Store app or measured agricultural accuracy.
