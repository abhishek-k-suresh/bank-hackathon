# Art spec — images to generate for the "Your window" scene

The window art will be **generated images** (from an image AI), not drawn in
code. This file is the brief for the generator: the style every image must
share, the full list of files, sizes, and animation frames.

Budget: the generator is limited to 150 images. This list uses **68**.

## 1. Rules for every image

The first attempt failed because the sheets did not match each other. To avoid
that:

- **One image per file.** No grids, no sheets. Animation frames are separate
  numbered files.
- **Same style prompt on every generation** (section 2). Generate the avatars
  first, then use them as the style reference for everything else.
- **PNG with transparent background** — except `bg-base.png`.
- **No baked effects:** no drop shadow, glow, border, frame, label or text
  (the only text allowed is a white `$` on money objects).
- **Subject centred, cropped tight,** with a small even margin.
- **Exact pixel size** as listed (or the same aspect ratio, larger).
- Folder: `app/img/`. File names exactly as listed, lower case.

## 2. Style — match the Westpac in-app illustrations

Reference: the "Round 1 / Round 2 / Round 3" money-tools cards in the Westpac app.

**Style prompt to paste into every generation**

> Flat vector illustration, Westpac banking app style. Solid flat colour
> shapes, no outlines, no gradients, no textures, no realistic shading; at most
> one lighter and one darker tone per shape. Rounded friendly geometry, simple
> silhouettes. Palette: purple #8E2DE2, light purple #B98AE8, lavender #DDBDF2,
> deep navy #1F1C4F, red #DA1710, magenta #E83FD8, white. Transparent
> background, no shadow, no text.

**Palette** (estimated from the reference screenshots — confirm against brand files)

| Role | Colour | Used for |
|---|---|---|
| Lavender wash | `#EFE3F9` | background |
| Lavender blob | `#DDBDF2` | blob behind the avatar, cloud shading |
| Primary purple | `#8E2DE2` | avatar top, key objects |
| Light purple | `#B98AE8` | secondary clothing, highlights |
| Deep navy | `#1F1C4F` | trousers, hair, dark details |
| Westpac red | `#DA1710` | money objects, flags, alerts |
| Magenta | `#E83FD8` | accents, sparkles |
| White | `#FFFFFF` | icons on coins, `$` marks |

**Characters:** flat skin tone, dot eyes, simple curved mouth. Purple top, navy
trousers. Mood is shown by pose and face only — same outfit in every mood.

## 3. Static images — 48

### 3.1 Avatars — 12 (male and female, 6 moods each)

Size **320 × 448**, full body, standing, **feet touching the bottom edge**,
same height and position in every file so they swap without jumping.

| Mood | Pose | Male file | Female file |
|---|---|---|---|
| thriving | arms up, cheering, big smile | `avatar-m-thriving.png` | `avatar-f-thriving.png` |
| happy | relaxed, smiling, one hand raised | `avatar-m-happy.png` | `avatar-f-happy.png` |
| okay | neutral, hands by sides, small smile | `avatar-m-okay.png` | `avatar-f-okay.png` |
| worried | hand on chin, raised brows | `avatar-m-worried.png` | `avatar-f-worried.png` |
| stressed | hands on head, tense face | `avatar-m-stressed.png` | `avatar-f-stressed.png` |
| calm | hand on chest, gentle supportive look | `avatar-m-calm.png` | `avatar-f-calm.png` |

The customer picks male or female in the app; both sets must be the same
size, pose framing and outfit colours.

### 3.2 Background — 5

Subtle and generic. Not a place: no buildings, trees, roads or horizon detail.
Mood changes are done in code by tinting and by showing or hiding the accents.

| File | Size | Content |
|---|---|---|
| `bg-base.png` | 1360 × 800 | flat lavender wash, one soft blob in the centre, low ground band. Opaque. |
| `bg-sun.png` | 200 × 200 | small flat sun |
| `bg-cloud-light.png` | 320 × 160 | soft white/lavender cloud |
| `bg-cloud-dark.png` | 320 × 160 | same cloud shape in grey-purple |
| `bg-sparkle.png` | 96 × 96 | four-point sparkle, magenta |

### 3.3 Hero goals — 3

Size **560 × 240**, full colour, side view. The grey "not saved yet" version
is made in code.

`goal-car.png` · `goal-house.png` · `goal-bike.png`

### 3.4 Holiday trip — 3 (comes out of the clouds, no photo frame)

Three separate pieces so the code can layer and move them.

| File | Size | Content |
|---|---|---|
| `trip-destination.png` | 200 × 140 | tiny island with a palm tree (or mountain peak), flat shapes |
| `trip-clouds.png` | 320 × 160 | cloud cluster that sits in front of the destination, hiding its lower half |
| `trip-plane.png` | 120 × 80 | small plane, side view, flying right |

### 3.5 Goal coins — 12 (one per category, icon merged into the coin)

Size **192 × 192**. Flat round coin, front view, in the category colour with a
darker rim. The icon is white and part of the coin face, not a sticker. No
spin frames — the coin only floats and glows, done in code.

| File | Coin colour | Icon |
|---|---|---|
| `coin-entertainment.png` | red `#E34948` | music note |
| `coin-electronics.png` | blue `#2A78D6` | laptop |
| `coin-travel.png` | teal `#1BAF7A` | paper plane |
| `coin-education.png` | purple `#6250D6` | graduation cap |
| `coin-gift.png` | pink `#E87BA4` | gift box |
| `coin-tech.png` | green `#1E9E5A` | phone |
| `coin-home.png` | amber `#EDA100` | house |
| `coin-health.png` | cyan `#1B9EA6` | medical cross |
| `coin-wedding.png` | magenta `#D6468F` | two rings |
| `coin-baby.png` | orange `#F0A23A` | pram |
| `coin-pet.png` | burnt orange `#EB6834` | paw |
| `coin-generic.png` | gold `#C79A14` | star |

### 3.6 Protection shields — 5 (insurance and emergency fund)

Two separate shields sit side by side in the top corner of the scene, each with
its own icon merged into the shield face so it is clear what it protects.
Size **144 × 168**, identical shield outline in all five. The green glow that
means "protected" is added in code, not drawn.

**Insurance shield** — icon: **umbrella**

| File | Content | Shown when |
|---|---|---|
| `shield-insurance-on.png` | green shield, white umbrella | the customer has insurance (glows green) |
| `shield-insurance-warning.png` | amber shield, white umbrella with a small warning `!` | no insurance (no glow) |

**Emergency fund shield** — icon: **lifebuoy ring**

| File | Content | Shown when |
|---|---|---|
| `shield-emergency-empty.png` | pale grey shield, darker grey lifebuoy | base layer, always underneath |
| `shield-emergency-fill.png` | green shield, white lifebuoy | revealed bottom-up by code to the % funded; fully revealed and glowing green when fully funded |
| `shield-emergency-warning.png` | amber shield, white lifebuoy with a small `!` | fund is below a quarter (no glow) |

The icon must be in exactly the same position in the empty and fill versions,
so the bottom-up reveal lines up. The warning `!` is drawn the same way on both
warning shields (same size, same corner) so "not protected" reads identically
for insurance and the emergency fund.

### 3.7 Safe and contents — 6

| File | Size | Content |
|---|---|---|
| `safe-closed.png` | 240 × 264 | safe, door shut, round dial |
| `safe-open.png` | 240 × 264 | same safe, door swung open, dark empty inside |
| `vault-coins.png` | 216 × 120 | small pile of coins |
| `vault-notes.png` | 216 × 120 | stacks of notes |
| `vault-bars.png` | 216 × 120 | gold bars |
| `vault-chest.png` | 216 × 120 | open treasure chest |

### 3.8 Small pieces — 2

| File | Size | Content |
|---|---|---|
| `loan-weight.png` | 96 × 128 | navy ball and short chain (no text; code scales it with debt) |
| `check-badge.png` | 96 × 96 | green circle with white tick |

## 4. Animation frames — 20

Each frame is its own file. Within a sequence: **same canvas size, same
character size, feet/base on the same pixel line**, only the pose changes.
Frame numbers start at 01 and loop back to 01.

| Sequence | Files | Frames | Size | What happens |
|---|---|---|---|---|
| Male celebrate | `avatar-m-celebrate-01.png` … `-06.png` | 6 | 320 × 448 | crouch → jump with arms up → land |
| Female celebrate | `avatar-f-celebrate-01.png` … `-06.png` | 6 | 320 × 448 | same motion as male |
| Savings burst | `burst-01.png` … `-04.png` | 4 | 240 × 240 | coins and sparkles pop outward from the centre, then fade |
| Safe door | `safe-door-01.png` … `-04.png` | 4 | 240 × 264 | closed → quarter → half → fully open (01 = `safe-closed`, 04 = `safe-open` look) |

Played at about 10 frames per second. Celebrate plays when a goal is
completed; burst and safe door play when savings reach a new tier.

## 5. Motion done in code (no images needed)

| Element | Motion |
|---|---|
| Goal coins | slow float up and down, soft glow in the coin's colour |
| Hero goal, trip | grey → colour reveal as % saved grows |
| Trip plane | moves along a dashed trail toward the clouds as % saved grows |
| Emergency shield | green fill rises with the emergency fund; soft green glow when fully funded |
| Insurance shield | soft green glow while the customer is insured |
| Clouds | slow sideways drift |
| Avatar | gentle breathing bob; pop when the mood changes |
| Sparkles | twinkle when mood is thriving |
| Loan weight | grows with debt, small sway |

Motion is switched off for people who set "reduce motion" on their device.

## 6. Count

| Group | Images |
|---|---|
| Avatars (2 × 6) | 12 |
| Background | 5 |
| Hero goals | 3 |
| Holiday trip | 3 |
| Goal coins | 12 |
| Protection shields (insurance 2, emergency 3) | 5 |
| Safe and contents | 6 |
| Small pieces | 2 |
| Animation frames | 20 |
| **Total** | **68 of 150** |

## 7. Generation order

1. `avatar-m-okay.png` and `avatar-f-okay.png` — approve the look first.
2. Remaining avatar moods, using step 1 as the style reference.
3. Celebrate frames.
4. Coins, shield, safe, vault contents, small pieces.
5. Goals, trip pieces, background.
6. Burst and safe-door frames.
