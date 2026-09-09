# Flag SVGs

Country flag icons for the phone-field country picker (`js/formEngine.js` →
`buildCountrySelect`). One file per country, named by lowercased ISO 3166-1
alpha-2 code (`pt.svg`, `fr.svg`, …), matching `code` in `js/countries.js`.

Source: [flag-icons](https://github.com/lipis/flag-icons) `flags/4x3/`, MIT
licensed. Only the ~30 EU/EEA countries in `EEA_COUNTRIES` are vendored here.

To refresh or add a country:

```sh
npm install --no-save flag-icons
cp node_modules/flag-icons/flags/4x3/<code>.svg img/flags/<code>.svg
```
