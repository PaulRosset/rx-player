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
var _a;
import isNode from "./is_node";
// true on IE11
// false on Edge and other IEs/browsers.
/* eslint-disable @typescript-eslint/strict-boolean-expressions */
/* eslint-disable @typescript-eslint/no-unsafe-member-access */
var isIE11 = !isNode &&
    !!window.MSInputMethodContext &&
    !!document.documentMode;
/* eslint-enable @typescript-eslint/strict-boolean-expressions */
/* eslint-enable @typescript-eslint/no-unsafe-member-access */
// true for IE / Edge
var isIEOrEdge = isNode ?
    false :
    navigator.appName === "Microsoft Internet Explorer" ||
        navigator.appName === "Netscape" &&
            /(Trident|Edge)\//.test(navigator.userAgent);
var isEdgeChromium = !isNode &&
    navigator.userAgent.toLowerCase().indexOf("edg/") !== -1;
var isFirefox = !isNode &&
    navigator.userAgent.toLowerCase().indexOf("firefox") !== -1;
var isSamsungBrowser = !isNode &&
    /SamsungBrowser/.test(navigator.userAgent);
/* eslint-disable @typescript-eslint/no-unsafe-member-access */
/* eslint-disable @typescript-eslint/no-unsafe-call */
var isSafari = !isNode && (Object.prototype.toString.call(window.HTMLElement).indexOf("Constructor") >= 0 ||
    ((_a = window.safari) === null || _a === void 0 ? void 0 : _a.pushNotification.toString()) ===
        "[object SafariRemoteNotification]");
/* eslint-enable @typescript-eslint/no-unsafe-member-access */
/* eslint-enable @typescript-eslint/no-unsafe-call */
var isSafariMobile = !isNode &&
    typeof navigator.platform === "string" &&
    /iPad|iPhone|iPod/.test(navigator.platform);
export { isEdgeChromium, isIE11, isIEOrEdge, isFirefox, isSafari, isSafariMobile, isSamsungBrowser, };
