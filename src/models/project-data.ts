/**
 * Obecný soubor projektu (může být zdrojový nebo binární soubor)
 */
export interface File{
	/** Cesta k souboru */
	Path: string;

	/** Base64 enkodovaný binární obsah souboru (ekvivalent Buffer v JS) */
	Content: string;
}

/**
 * Zdrojový soubor pro překlad FPGA
 */
export interface FpgaFile extends File{
	/** Soubor má být použit pouze pro simulaci */
	SimOnly: boolean;

	/** Název knihovny souboru. Pokud není zadáno, použije se název z projektu */
	Library?: string;
}

/**
 * Konfigurace projektu včetně zdrojových souborů
 */
export interface ProjectData{
	/** Verze souboru, pro případ dalších revizí, které nejsou navzájem kompatibilní */
	Version: "1.0.0";

	/** Konfigurace MCU části */
	Mcu: {
		/** Má se kompilovat s matematickou knihovnou */
		UseMathLib: boolean;

		/** Zdrojové .c soubory */
		Files: File[];
		//HeaderFiles: File[]; // Není potřeba, vždy se sestavuje celý projekt

		/** Hlavičkové soubory k .c souborům */
		Headers: File[];
	}

	/** Konfigurace FPGA části */
	Fpga: {
		/** Používá projekt některou z architektur (architektura není "none") */
		UseArchitecture: boolean;

		/** Název nejvyšší entity */
		TopLevelEntity: string;

		/** Identifikační řetězec použitého FPGA. Musí obsahovat tři části oddělené pomlčkou */
		Chip: string;

		/** Stupeň optimalizace. Formát řetězce je "cíl:stupeň", př. "speed:1" */
		Optimization: string;

		/** Frekvence CLK hodin. Podporované možnosti jsou "25MHz", "20MHz", "40MHz" a "50MHz" */
		DcmFrequency: string;

		/** UCF soubor pro syntézu */
		UcfFile: File;

		/** Konfigurační soubor simulace za pomocí ISIM */
		IsimFile?: File;

		/** Název knihovny pro překlad */
		Library: string;

		//NgcPath?: File; // TODO Podpora vlastní NGC složky v další verzi

		/** Zdojové soubory .vhd */
		Files: FpgaFile[];
	}
}
