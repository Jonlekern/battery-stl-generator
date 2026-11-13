import { render } from 'preact';
import { Diagnostic } from './diagnostic';
import { App } from './interface/App';
import './style.css';

const racine = document.getElementById('app')!;
const diagnostic = new URLSearchParams(location.search).has('diagnostic');

render(diagnostic ? <Diagnostic /> : <App />, racine);
