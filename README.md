# FITkit rozšíření pro Visual Studio Code

Rozšíření pro správu FITkit projektů a jejich vzálený překlad a simulaci. Rozšíření také obsahuje utilitu pro programování a komunikaci s připojenými přípravky FITkit.


## Požadavky

Pro plné využití tohoto rozsíření je nutné být připojen k internetu a mít možnost autentizace (např. být studentem VUT FIT)

## Návod k použití
Rozšíření přidá novou sekci do postranního panelu. Pod touto sekcí se nachází lokální správa projektů včetně vytváření a mazání.

Pokud rozšíření detekuje, že je otevřen FITkit projekt, také je přidán ovládací panel umožňující překlad, simulaci, atd. Tento ovládací panel se nachází v sekci "Explorer" (je to sekce, kde jsou zobrazeny soubory otevřeného projektu). Více info viz [Otevřený projekt](#Otevřený-projekt).

### Správa projektů
Po prvním spuštění (nebo pokud nebude nalezen lokální repozitář) budete vyzváni dialogovým oknem ke stažení kopie repozitíře ze serveru. Tuto akci stačí potvrdit a editor se sám repozitář pokusí stáhnout.

Pokud se podaří najít repozítář, zobrazí se seznam kategorií a projektů. Kliknutím pravého tlačítka na jednotlivé položky jsou k dispozici další akce. Dvojklikem se vybraný projekt otevře v editoru.

### Otevřený projekt
Po otevření FITkit projektu se v hlavní sekci "Explore" zobrazí ovládací panel.

Tento ovladací panel poskytuje rychlé akce související s FItkit projektem. Kliknutím na akci je akce spuštěna. Většina akcí po spuštění zobrazuje průběh do terminálu. Vždy může běžet pouze jedna akce (nelze tak například překládat projekt a mít puštěnou simulaci). Po skončení akce se terminál nezavře ihned, ale čeká na stisk libovolné klávesy. Akci můžete kdykoliv ukončit "zabitím" terminálu (ikona koše u terminálu vpravo nahoře)

Může se stát, že panel bude "sbalený" - bude vidět pouze jeho název `FITkit project`. V tom případě stačí panel rozbalit kliknutím na název.

## Nastavení rozšíření
Toto rozšíření zpřístupňuje v nastavení editoru následující položky:

* **`fitkit.projectRepository.cloneUrl`**: Změna adresy, ze které je stažena zazipovaná kopie repozitáře projektů. Archív musí obsahovat složky `/mcu` `/base` `/fpga` a `/apps`
* **`fitkit.projectRepository.path`**: Lokální cesta, kde se nachází nebo bude vytvořen repozitář projektů. Pokud je cesta relativní, vyhledává se vzhledem ke složce uživatele (př.: Je zadána cesta `fitkitsvn`, ta se přeloží na a bsolutní ve Windows `C:/Users/<user>/fitkitsvn`)
* **`fitkit.remoteBuild.serverAddress`**: Adresa včetně portu použitá pro připojení k překladovému serveru.
* **`fitkit.authServer.requestUrl`**: Adresa API autentizačního serveru pro vytvoření a zpracování požadavků na nový autentizační token. *(Doporučeno neměnit)*
* **`fitkit.authServer.generateUrl`**: Adresa stránky autentizačního serveru, která se zobrazí uživateli pro potvrzení vygenerování uatentizačního tokenu. *(Doporučeno neměnit)*
