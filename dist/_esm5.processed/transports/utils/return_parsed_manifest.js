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
import { concat as observableConcat, of as observableOf, } from "rxjs";
/**
 * As a Manifest instance is obtained, emit the right `warning` events
 * (according to the Manifest's `parsingErrors` property`) followed by the right
 * `parsed` event, as expected from a Manifest parser.
 * @param {Manifest} manifest
 * @param {string|undefined} url
 * @returns {Observable}
 */
export default function returnParsedManifest(manifest, url) {
    var warningEvts$ = observableOf.apply(void 0, manifest.parsingErrors.map(function (error) { return ({
        type: "warning",
        value: error,
    }); }));
    return observableConcat(warningEvts$, observableOf({ type: "parsed",
        value: { manifest: manifest, url: url } }));
}
