interface FpgaFileDetails{
	_context?: string;
	_library?: string;
	$: string;
}

type FpgaFile = FpgaFileDetails | string;

export interface FpgaOrderedSource{
	file?: FpgaFile;
	files?: FpgaFile;
	include?: string;
}

interface Fpga{
	_use?: string;
	_architecture?: string;
	_dcmfrequency?: string;
	_toplevelentity?: string;
	_ucffile?: string;
	_fpgachip?: string;
	_optimization?: string;
	_ngcpath?: string;
	_library?: string;
	file?: FpgaFile | FpgaFile[];
	files?: FpgaFile | FpgaFile[];
	include?: string | string[];
	"#ordered"?: FpgaOrderedSource[];
}

interface McuFileDetails{
	_location?: string;
	$: string;
}

type McuFile = McuFileDetails | string;

interface Mcu{
	_mathlibrary?: string;

	file?: McuFile | McuFile[];
	files?: McuFile | McuFile[];
	headerfile?: McuFile | McuFile[];
	include?: string | string[];
}

interface Project{
	_outputprefix?: string;

	name: string;
	author?: string;
	authoremail?: string;
	revision?: string;
	description?: string;

	mcu?: Mcu;
	fpga?: Fpga;
}

/**
 * Struktura XML konfiguračního souboru projektu (project.xml)
 *
 * @see https://merlin.fit.vutbr.cz/FITkit/docs/navody/kompilacev2.html
 */
export interface ProjectConfigXml{
	project?: Project;
	library?: Project;
	package?: Project;
}

export interface ProjectConfig extends Project{
	type: "project" | "library" | "package";
}
