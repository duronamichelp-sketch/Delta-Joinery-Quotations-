# Delta Joinery Quotations

Independent Next.js 13 application for unit and hardware costing, with your Delta Joinery logo.

## Run
`npm install` then `npm run dev`.

## Pages
- `/` — quotation details, selectable units, door finishes, hardware, adjustable numeric quantities, summary and print/PDF.
- `/units` — add/delete standard units and hardware; edit door rates.

## Important
- Data uses browser localStorage (`dj_units`, `dj_hardware`, `dj_door_rates`, `dj_quote`). Saved data on the same browser and origin is retained when updating the app; different URLs/origins have separate storage.
- Use the browser print dialog to save a PDF copy of finished quotes.
- Door sqm is the **total combined door surface area per unit**, multiplied by quantity and material rate. Number of doors is informational; add hinges separately to the quotation.
- Unit price, hardware price and door material rates are directly entered cost figures. No VAT/labour/waste is added automatically.
- This application is independent of all Veylo projects and repositories.
