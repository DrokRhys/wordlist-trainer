## Data cleanup ideas (aligned with source PDF)

Základ: slovník musí zůstat obsahově totožný s PDF (ref/ef3e_pre-int_cz_wl.pdf), jen být čitelný pro uživatele testu. Nepřidávat ani neodstraňovat slovíčka, pouze čistit formu.

1) `word` bez metadat  
   - Vyházet přípony jako `phr`, `phr v`, zkratky typu `v.`, `adj.`, závorkové poznámky apod. Všechno, co patří do PoS, držet jen v `pos`. Cíl: zobrazit čistý výraz stejně jako v PDF.

2) Whitespace a interpunkce  
   - Srazit vícenásobné mezery, odstranit koncové čárky/tečky v `word`, sjednotit ASCII apostrofy/uvozovky, zbavit se zero-width znaků. Zdrojový JSON má být už čistý (ne spoléhat jen na runtime čištění).

3) Validace PoS vůči PDF  
   - Udržet PoS v malém schváleném setu (např. `n`, `v`, `adj`, `adv`, `prep`, `pron`, `phr v`, `phr`). Pokud PDF dává PoS jinak, mapovat na nejbližší ekvivalent a flagovat odchylky k ručnímu schválení.

4) Duplicity/konflikty  
   - Hledat identické `word`+`translation` s různými ID nebo stejné `word` v rámci stejné unit/section s rozdílným překladem. Řešit sloučením nebo označením pro revizi, ale bez mazání obsahu PDF.

5) Jazykové štítky a obsah jednotek  
   - Každé slovíčko musí mít `lang`. Prověřit, že unit/section neobsahuje mix jazyků, pokud to PDF neuvádí. Nesahat na překlady ani nerozdělovat jednotky, pokud to není explicitně v PDF.

6) Příklady  
   - Vyflagovat příklady s evidentními překlepy, placeholdery nebo bez interpunkce; případné opravy držet minimální a v duchu PDF (nepřepisovat význam slov).

7) Konzistence názvů sekcí/unit  
   - Normalizovat pravopis/kapitalizaci názvů sekcí tak, jak jsou v PDF (např. „Vocabulary Banks“, „Useful words and phrases“), aby filtry seděly a nevznikaly duplicitní varianty.

8) Dopad na historii  
   - Při přejmenování/čištění `word` neměnit ID; pokud by se ID musela změnit (nemělo by), zvážit migraci/čištění `data/history.json`, aby ukazovala na existující slova.

9) Zálohy a report  
   - Před bulk úpravami vždy uložit snapshot `data/vocabulary.json`. Skript by měl generovat report (co bylo změněno, co je podezřelé, co je k ruční kontrole).

Nástrojování: krátký Node/TS skript, který načte JSON, aplikuje regexové čistění `word`, validaci PoS proti whitelistu, normalizaci mezer, detekci duplikátů a generuje diff/report. Všechny úpravy dělat bezztrátově vůči obsahu PDF.
