# React + TypeScript + Vite

This template provides a minimal setup to get React working in Vite with HMR and some ESLint rules.

Currently, two official plugins are available:

- [@vitejs/plugin-react](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react) uses [Oxc](https://oxc.rs)
- [@vitejs/plugin-react-swc](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react-swc) uses [SWC](https://swc.rs/)

## React Compiler

The React Compiler is not enabled on this template because of its impact on dev & build performances. To add it, see [this documentation](https://react.dev/learn/react-compiler/installation).

## Expanding the ESLint configuration

If you are developing a production application, we recommend updating the configuration to enable type-aware lint rules:

```js
export default defineConfig([
  globalIgnores(['dist']),
  {
    files: ['**/*.{ts,tsx}'],
    # Backend Engineering Notes Admin
      // Other configs...
    Admin editor for the Backend Engineering Notes API. It manages pages and their question/answer content through authenticated `/api/admin/**` endpoints.
      // Remove tseslint.configs.recommended and replace with this
    ## Local development
      // Alternatively, use this for stricter rules
    ```sh
    npm install
    VITE_API_BASE_URL=http://localhost:8080 npm run dev
    ```
      tseslint.configs.stylisticTypeChecked,
    Configure the API host as the `VITE_API_BASE_URL` repository variable in the GitHub Pages environment. The deployment workflow publishes the app under `/backend-engineering-notes-admin/`.
      // Other configs...
      parserOptions: {
