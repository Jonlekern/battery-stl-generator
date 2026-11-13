import { render } from 'preact';
import { Diagnostic } from './diagnostic';

const racine = document.getElementById('app')!;
const diagnostic = new URLSearchParams(location.search).has('diagnostic');

render(diagnostic ? <Diagnostic /> : <h1>Insert Piles</h1>, racine);
