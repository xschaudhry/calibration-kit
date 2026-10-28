# calibration-kit

Before an AI quoting agent talks to a single customer, it should price jobs the way the shop does. This kit checks that.

You give it the shop's past hand-written quotes next to the agent's quotes for the same jobs. It flags every quote more than **5%** away from the shop's, explains why, and gives a clear go-live answer: **ready** only when at least **95%** of a random batch is within range.

No dependencies. Node 18+.

## Quick start

```bash
node calibrate.js data/sample-quotes.csv
```

```
      Job                                    Manual         AI   Diff
----  ----------------------------------  ---------  ---------  -----
ok    Front brakes - 2018 Civic             $498.00    $512.00  +2.8%
ok    AC recharge - 2020 RAV4               $295.00    $289.00  -2.0%
FLAG  Ignition coil - 2018 Civic            $340.00    $361.00  +6.2%
ok    40 gal gas water heater swap        $2,080.00  $2,140.00  +2.9%
FLAG  Furnace igniter replacement           $248.00    $265.00  +6.8%
...
22 of 24 within 5% (91.7%). 2 flagged. Average difference 2.54%.
NOT READY: needs 95% within 5%. Fix the flagged quotes and run again.
```

Each flag gets a reason and a fix, for example:

> **Ignition coil** (+6.2%): Agent priced the OEM coil ($86); shop stocks aftermarket ($65). Fix: add aftermarket part to price book.

After the price book is fixed, the same jobs pass:

```bash
node calibrate.js data/sample-quotes-after-fixes.csv
# 24 of 24 within 5% (100%). READY: meets the 95% go-live rule.
```

## Options

| Option | Default | What it does |
|---|---|---|
| `--threshold` | `5` | Percent difference that counts as a flag |
| `--pass-rate` | `95` | Percent of quotes that must be within range to go live |
| `--sample` | all | Check a random batch, e.g. `--sample 20` |
| `--seed` | `1` | Makes the random batch repeatable |
| `--report` | none | Writes a Markdown report to share with the owner |

The exit code is `0` when ready and `1` when not, so it can run automatically after every price-book change.

## Input format

A CSV with these columns (`reason` is optional):

```csv
job,manual_quote,ai_quote,reason
Front brakes - 2018 Civic,498.00,512.00,
Ignition coil - 2018 Civic,340.00,361.00,"Agent priced OEM coil; shop uses aftermarket"
```

Dollar signs and thousands separators are fine (`"$2,140.00"`).

## How it fits a build

1. The shop shares 20 or more past quotes.
2. The agent quotes the same jobs (see [quote-agent-demo](https://github.com/xschaudhry/quote-agent-demo)).
3. This kit flags the gaps. Each one becomes a fix to the price book or the rules.
4. Repeat until a random batch of 20 passes at 95% or higher, then go live with the owner still approving quotes.

```bash
npm test
```

---

Built by [Chaudhry Usman](https://www.linkedin.com/in/chaudhryusmantrx/) · TRXmode. Sample data is made up. Contact: usman@trxmode.com
