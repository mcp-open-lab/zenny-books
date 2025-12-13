## Design system (shadcn/ui)

### Theme tokens

Theme tokens live in `app/globals.css` as CSS variables (HSL):

- `--background`, `--foreground`
- `--card`, `--card-foreground`
- `--primary`, `--primary-foreground`
- `--secondary`, `--muted`, `--accent`
- `--border`, `--input`, `--ring`
- **Semantic**: `--success`, `--warning`, `--info`, `--destructive` (+ `*-foreground`)

We use a **Teal + Gold** inspired palette to avoid the default black/white feel while keeping a premium, trustworthy fintech vibe.

### Component variants

#### `Button` (`components/ui/button.tsx`)

- **Primary hover**: subtle lift + glow (shadow based on `--primary`)
- **Async success pulse**: set `data-success=\"true\"` on the button to show a short success ring

#### `Card` (`components/ui/card.tsx`)

- `variant=\"kpi\"`: top accent border + subtle hover elevation for KPI-style cards

#### `Badge` (`components/ui/badge.tsx`)

New variants:
- `success`, `warning`, `info`
- `pending`, `paid`, `overdue`

#### `TableRow` (`components/ui/table.tsx`)

- Hover: uses muted tint
- Selected: left accent bar + primary tint background via `data-state=\"selected\"`

### Usage rules

- Prefer tokens (`bg-background`, `text-foreground`, `text-muted-foreground`) over hardcoded colors.
- If you need a new semantic color, add a token first (don’t inline hex values).


