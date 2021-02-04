/**
 * Copyright 2015 CANAL+ Group
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */
import { isFirefox } from "./browser_detection";
import { getFirefoxVersion } from "./browser_version";
/**
 * This functions tells if the RxPlayer can trust on any browser data
 * about video element visibility and size.
 *
 * On Firefox (version >= 67) :
 * - The PIP feature exists but can be disabled by default according
 * to the OS and the channel used for updating / getting Firefox binaries.
 * - There is no API to know if the Picture-in-picture (PIP) is enabled
 * - There is no API to get the width of the PIP window
 *
 * The element clientWidth tells the width of the original video element, and
 * no PIP window API exists to determine its presence or width. Thus, there are
 * no way to determine the real width of the video window, as we can't know when
 * the PIP feature or window is enabled, and we can't have access to the windo
 * size information.
 *
 * Moreover, when the document is considered as hidden (e.g. in case of hidden
 * tab), as there is no way to know if the PIP feature or window is enabled,
 * we can't know if the video window is visible or not.
 * @returns {boolean}
 */
export default function canRelyOnVideoVisibilityAndSize() {
    var _a, _b;
    /* eslint-disable @typescript-eslint/no-unsafe-member-access */
    if (!isFirefox) {
        return true;
    }
    var firefoxVersion = getFirefoxVersion();
    if (firefoxVersion === null || firefoxVersion < 67) {
        return true;
    }
    return ((_b = (_a = HTMLVideoElement) === null || _a === void 0 ? void 0 : _a.prototype) === null || _b === void 0 ? void 0 : _b.requirePictureInPicture) !== undefined;
    /* eslint-enable @typescript-eslint/no-unsafe-member-access */
}
