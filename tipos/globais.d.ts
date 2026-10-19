// Globais do navegador usados pelo site (só para a checagem de tipos; não é publicado).

interface Window {
    /** Chart.js 4, carregado do CDN em index.html. */
    Chart?: any;
    /** Marcado pelo onerror do <script> do Chart.js. */
    chartErro?: boolean;
}
