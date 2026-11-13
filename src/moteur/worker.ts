/// <reference lib="webworker" />
import urlPolice from '@expo-google-fonts/arimo/700Bold/Arimo_700Bold.ttf?url';
import type { Piece } from '../types';
import { ErreurOpenScad } from './erreurs';
import { rendre } from './openscad';

export interface DemandeRendu {
  id: number;
  scad: string;
  piece: Piece;
}

export type ReponseRendu =
  | { id: number; ok: true; stl: ArrayBuffer }
  | { id: number; ok: false; message: string; journal: string[] };

let police: Promise<Uint8Array> | undefined;

function chargerPolice(): Promise<Uint8Array> {
  police ??= fetch(urlPolice)
    .then((r) => {
      if (!r.ok) throw new Error(`Police introuvable (${r.status})`);
      return r.arrayBuffer();
    })
    .then((b) => new Uint8Array(b))
    .catch((e) => {
      police = undefined; // on réessaiera au prochain rendu
      throw e;
    });
  return police;
}

const contexte = self as unknown as DedicatedWorkerGlobalScope;

contexte.onmessage = async (e: MessageEvent<DemandeRendu>) => {
  const { id, scad, piece } = e.data;
  let reponse: ReponseRendu;
  try {
    const stl = await rendre(scad, piece, await chargerPolice());
    // On transfère un tampon qui ne contient que le STL.
    const entier = stl.byteOffset === 0 && stl.byteLength === stl.buffer.byteLength;
    const tampon = (entier ? stl.buffer : stl.slice().buffer) as ArrayBuffer;
    reponse = { id, ok: true, stl: tampon };
    contexte.postMessage(reponse, [tampon]);
    return;
  } catch (err) {
    reponse = {
      id,
      ok: false,
      message: err instanceof Error ? err.message : String(err),
      journal: err instanceof ErreurOpenScad ? err.journal : [],
    };
  }
  contexte.postMessage(reponse);
};
