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

/* tslint:disable no-unsafe-any */
describe("transports utils - checkISOBMFFIntegrity", () => {
  beforeEach(() => {
    jest.resetModules();
  });

  it("should check just ftyp and and moov integrity for init segments", () => {
    const findCompleteBoxSpy = jest.fn(() => 45);
    jest.mock("../find_complete_box", () => ({ __esModule: true,
                                               default: findCompleteBoxSpy }));
    const checkISOBMFFIntegrity = require("../check_isobmff_integrity").default;
    const myUint8Array = new Uint8Array([0, 1, 2]);
    expect(() => checkISOBMFFIntegrity(myUint8Array, true)).not.toThrow();
    expect(findCompleteBoxSpy).toHaveBeenCalledTimes(2);
    expect(findCompleteBoxSpy).toHaveBeenCalledWith(myUint8Array, 0x66747970);
    expect(findCompleteBoxSpy).toHaveBeenCalledWith(myUint8Array, 0x6D6F6F76);
  });

  it("should check just moof and and mdat integrity for regular segments", () => {
    const findCompleteBoxSpy = jest.fn(() => 45);
    jest.mock("../find_complete_box", () => ({ __esModule: true,
                                               default: findCompleteBoxSpy }));
    const checkISOBMFFIntegrity = require("../check_isobmff_integrity").default;
    const myUint8Array = new Uint8Array([0, 1, 2]);
    expect(() => checkISOBMFFIntegrity(myUint8Array, false)).not.toThrow();
    expect(findCompleteBoxSpy).toHaveBeenCalledTimes(2);
    expect(findCompleteBoxSpy).toHaveBeenCalledWith(myUint8Array, 0x6D6F6F66);
    expect(findCompleteBoxSpy).toHaveBeenCalledWith(myUint8Array, 0x6D646174);
  });

  it("should throw an other error if an init segment is missing a complete ftyp", () => {
    const findCompleteBoxSpy = jest.fn((_, box) => box === 0x66747970 ? -1 : 45);
    jest.mock("../find_complete_box", () => ({ __esModule: true,
                                               default: findCompleteBoxSpy }));
    const OtherError = require("../../../errors").OtherError;
    const checkISOBMFFIntegrity = require("../check_isobmff_integrity").default;
    const myUint8Array = new Uint8Array([0, 1, 2]);
    let error : Error | null = null;
    try {
      checkISOBMFFIntegrity(myUint8Array, true);
    } catch (e) {
      error = e;
    }
    expect(error).toBeInstanceOf(OtherError);
    expect((error as any).name).toEqual("OtherError");
    expect((error as any).type).toEqual("OTHER_ERROR");
    expect((error as any).code).toEqual("INTEGRITY_ERROR");
    expect((error as any).message)
      .toEqual("OtherError (INTEGRITY_ERROR) Incomplete `ftyp` box");
  });

  it("should throw an other error if an init segment is missing a complete moov", () => {
    const findCompleteBoxSpy = jest.fn((_, box) => box === 0x6D6F6F76 ? -1 : 45);
    jest.mock("../find_complete_box", () => ({ __esModule: true,
                                               default: findCompleteBoxSpy }));
    const OtherError = require("../../../errors").OtherError;
    const checkISOBMFFIntegrity = require("../check_isobmff_integrity").default;
    const myUint8Array = new Uint8Array([0, 1, 2]);
    let error : Error | null = null;
    try {
      checkISOBMFFIntegrity(myUint8Array, true);
    } catch (e) {
      error = e;
    }
    expect(error).toBeInstanceOf(OtherError);
    expect((error as any).name).toEqual("OtherError");
    expect((error as any).type).toEqual("OTHER_ERROR");
    expect((error as any).code).toEqual("INTEGRITY_ERROR");
    expect((error as any).message)
      .toEqual("OtherError (INTEGRITY_ERROR) Incomplete `moov` box");
  });

  /* tslint:disable max-line-length */
  it("should throw an other error if a regular segment is missing a complete moof", () => {
  /* tslint:enable max-line-length */
    const findCompleteBoxSpy = jest.fn((_, box) => box === 0x6D6F6F66 ? -1 : 45);
    jest.mock("../find_complete_box", () => ({ __esModule: true,
                                               default: findCompleteBoxSpy }));
    const OtherError = require("../../../errors").OtherError;
    const checkISOBMFFIntegrity = require("../check_isobmff_integrity").default;
    const myUint8Array = new Uint8Array([0, 1, 2]);
    let error : Error | null = null;
    try {
      checkISOBMFFIntegrity(myUint8Array, false);
    } catch (e) {
      error = e;
    }
    expect(error).toBeInstanceOf(OtherError);
    expect((error as any).name).toEqual("OtherError");
    expect((error as any).type).toEqual("OTHER_ERROR");
    expect((error as any).code).toEqual("INTEGRITY_ERROR");
    expect((error as any).message)
      .toEqual("OtherError (INTEGRITY_ERROR) Incomplete `moof` box");
  });

  /* tslint:disable max-line-length */
  it("should throw an other error if a regular segment is missing a complete mdat", () => {
  /* tslint:enable max-line-length */
    const findCompleteBoxSpy = jest.fn((_, box) => box === 0x6D646174 ? -1 : 45);
    jest.mock("../find_complete_box", () => ({ __esModule: true,
                                               default: findCompleteBoxSpy }));
    const OtherError = require("../../../errors").OtherError;
    const checkISOBMFFIntegrity = require("../check_isobmff_integrity").default;
    const myUint8Array = new Uint8Array([0, 1, 2]);
    let error : Error | null = null;
    try {
      checkISOBMFFIntegrity(myUint8Array, false);
    } catch (e) {
      error = e;
    }
    expect(error).toBeInstanceOf(OtherError);
    expect((error as any).name).toEqual("OtherError");
    expect((error as any).type).toEqual("OTHER_ERROR");
    expect((error as any).code).toEqual("INTEGRITY_ERROR");
    expect((error as any).message)
      .toEqual("OtherError (INTEGRITY_ERROR) Incomplete `mdat` box");
  });
});
/* tslint:enable no-unsafe-any */
