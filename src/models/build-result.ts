/**
 * Výsledek sestavení projektu. Součástí zprávy o dokončení sestavení
 */
export interface BuildResult{
	/** Návratový kód spuštěného procesu sestavení */
	ExitStatus: number;

	/** Binární data pro MCU Fitkit 1.x enkodované do base64 */
	McuV1Binary?: string;

	/** Binární data pro MCU Fitkit 2.x enkodované do base64 */
	McuV2Binary?: string;

	/** Binární data pro FPGA enkodované do base64 */
	FpgaBinary?: string;
}
