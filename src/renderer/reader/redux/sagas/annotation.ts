// ==LICENSE-BEGIN==
// Copyright 2017 European Digital Reading Lab. All rights reserved.
// Licensed to the Readium Foundation under one or more contributor license agreements.
// Use of this source code is governed by a BSD-style license
// that can be found in the LICENSE file exposed on Github (readium) in the project repository.
// ==LICENSE-END==

import { nanoid } from "nanoid";
import { takeSpawnEvery } from "readium-desktop/common/redux/sagas/takeSpawnEvery";
import { SagaIterator } from "redux-saga";

import { readerLocalActionAnnotationUI, readerLocalActionAnnotations, readerLocalActionHighlights, readerLocalActionSetLocator } from "../actions";
import { IHighlightHandlerState } from "../state/highlight";
import { all, put as putTyped, select as selectTyped, call as callTyped } from "typed-redux-saga";
import { IReaderRootState } from "readium-desktop/common/redux/states/renderer/readerRootState";
import { IAnnotationStateWithoutUUID } from "readium-desktop/common/redux/states/annotation";
import { IHighlightDefinition } from "r2-navigator-js/dist/es8-es2017/src/electron/common/highlight";

function createAnnotationHighlightObj(href: string, def: IHighlightDefinition): IHighlightHandlerState {
    const highlight: IHighlightHandlerState = {
        uuid: nanoid(),
        type: "annotation",
        href,
        def,
    };
    return highlight;
}

function* createAnnotationHighlightFromAnnotationPush(action: readerLocalActionAnnotations.push.TAction): SagaIterator {
    const {
        href,
        def,
    } = action.payload;
    yield* putTyped(readerLocalActionHighlights.handler.push.build(createAnnotationHighlightObj(href, def)));
}

function* selectionInfoWatcher(action: readerLocalActionSetLocator.TAction): SagaIterator {
    const {
        selectionInfo,
        selectionIsNew,
        locator: { href },
    } = action.payload;

    // 1. Check if annotation mode is enabled
    if (!(yield* selectTyped((store: IReaderRootState) => store.annotation.enable))) {
        return ;
    }

    const color = yield* selectTyped((store: IReaderRootState) => store.annotation.color);

    // 2. Check if it is a user selection and a new selection
    if (
        selectionInfo
        && selectionIsNew
    ) {

        const def: IHighlightDefinition = {
            color: color.red == 0 && color.green == 0 && color.red == 0
                ? {
                    red: 255,
                    green: 0,
                    blue: 0,
                }
                : color,
            selectionInfo,
        };
        const annotation: IAnnotationStateWithoutUUID = {
            name: "",
            comment: "",
            hash: yield* callTyped(() => crypto.subtle.digest("SHA-256", Buffer.from(`${href}:${JSON.stringify(def)}`))
                .then((a) => Buffer.from(a).toString("hex"))),
            href,
            def,
        }
        yield* putTyped(readerLocalActionAnnotations.push.build(annotation));
    }
}

function* annotationUIEnable(_action: readerLocalActionAnnotationUI.enable.TAction): SagaIterator {

    // move all anotations from reader.annotations to reader.hightlight.handler
    const annotations = yield* selectTyped((store: IReaderRootState) => store.reader.annotation.map(([, v]) => v));
    const annotationHightlightArray = annotations.map(({href, def}) => createAnnotationHighlightObj(href, def));
    yield* putTyped(readerLocalActionHighlights.handler.push.build(...annotationHightlightArray));
}

function* annotationUIDisable(_action: readerLocalActionAnnotationUI.enable.TAction): SagaIterator {

    const highlights = yield* selectTyped((store: IReaderRootState) => store.reader.highlight.handler.map(([, v]) => v));
    const highlightsAnnotation = highlights.filter((v) => v.type === "annotation");

    // FYI: "Uncaught SyntaxError: Too many arguments in function call (only 65535 allowed)"
    yield* putTyped(readerLocalActionHighlights.handler.pop.build(...highlightsAnnotation))
}

export const saga = () =>
    all([
        takeSpawnEvery(
            readerLocalActionAnnotationUI.cancel.ID,
            annotationUIDisable,
            (e) => console.log("readerLocalActionAnnotationUI.cancel", e),
        ),
        takeSpawnEvery(
            readerLocalActionAnnotationUI.enable.ID,
            annotationUIEnable,
            (e) => console.log("readerLocalActionAnnotationUI.enable", e),
        ),
        takeSpawnEvery(
            readerLocalActionAnnotations.push.ID,
            createAnnotationHighlightFromAnnotationPush,
            (e) => console.log("readerLocalActionAnnotations.push", e),
        ),
        takeSpawnEvery(
            readerLocalActionSetLocator.ID,
            selectionInfoWatcher,
            (e) => console.log("readerLocalActionSetLocator", e),
        ),
        takeSpawnEvery(
            readerLocalActionSetLocator.ID,
            () => console.log("hello"),
            (e) => console.log("readerLocalActionSetLocator", e),
        ),
    ]);
