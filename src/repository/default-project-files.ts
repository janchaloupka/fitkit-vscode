/** Výchozí main.c po vytvoření nového projektu */
export const DefaultMCUFile = `#include <fitkitlib.h>

/**
 * Vypis uzivatelske napovedy (funkce se vola pri vykonavani prikazu "help")
 */
void print_user_help(void)
{

}

/**
 * Dekodovani uzivatelskych prikazu a jejich vykonavani
 */
unsigned char decode_user_cmd(char *cmd_ucase, char *cmd)
{
    return (CMD_UNKNOWN);
}

/**
 * Inicializace periferii/komponent po naprogramovani FPGA
 */
void fpga_initialized() {}

/**
 * Hlavni funkce
 */
int main(void)
{
    initialize_hardware();

    set_led_d6(1);  // Rozsvitit LED D6
    set_led_d5(1);  // Rozsvitit LED D5

    short counter = 0;
    while (1)
    {
        // Zpozdeni 1ms
        delay_ms(1);

        counter++;
        if (counter == 500)
        {
            // Invertovat LED
            flip_led_d6();
            counter = 0;
        }

        // Obsluha terminalu
        terminal_idle();
    }
}
`;

/** Výchozí top.vhd po vytvoření nového projektu */
export const DefaultTopVHDLFile = `library ieee;
use ieee.std_logic_1164.all;
use ieee.std_logic_arith.all;
use ieee.std_logic_unsigned.all;

architecture main of tlv_gp_ifc is

begin
    -- TODO doplnit kód
end main;
`;

/** Výchozí testbench nového projektu */
export const DefaultTestBench = `library ieee;
use ieee.std_logic_1164.all;
use ieee.std_logic_arith.all;
use ieee.std_logic_unsigned.all;
use ieee.std_logic_textio.all;
use ieee.numeric_std.all;
use std.textio.all;

-- ----------------------------------------------------------------------------
--                        Entity declaration
-- ----------------------------------------------------------------------------
entity testbench is
end entity testbench;

-- ----------------------------------------------------------------------------
--                      Architecture declaration
-- ----------------------------------------------------------------------------
architecture behavioral of testbench is

    signal smclk   : std_logic := '1';

    signal ledf  : std_logic;
    signal p3m   : std_logic_vector(7 downto 0) := (others=>'Z');
    signal afbus : std_logic_vector(11 downto 0) :=(others =>'Z');
    signal xbus  : std_logic_vector(45 downto 0) :=(others =>'Z');
    signal rdbus : std_logic_vector(7 downto 0) :=(others =>'Z');
    signal ldbus : std_logic_vector(7 downto 0) :=(others =>'Z');

    signal ispi_clk : std_logic:='1';
    signal ispi_cs  : std_logic:='1';
    signal ispi_di  : std_logic:='Z';
    signal ispi_do  : std_logic:='1';

begin
    --Unit under test
    uut: entity work.fpga
    port map(
        SMCLK    => smclk,
        ACLK     => '0',
        FCLK     => '0',
        LEDF     => ledf,

        SPI_CLK  => ispi_clk,
        SPI_CS   => '1',
        SPI_FPGA_CS => ispi_cs,
        SPI_DI   => ispi_di,
        SPI_DO   => ispi_do,

        KIN      => open,
        KOUT     => (others => 'Z'),

        LE       => open,
        LRW      => open,
        LRS      => open,
        LD       => ldbus,

        RA       => open,
        RD       => rdbus,
        RDQM     => open,
        RCS      => open,
        RRAS     => open,
        RCAS     => open,
        RWE      => open,
        RCKE     => open,
        RCLK     => open,

        P3M      => p3m,
        AFBUS    => afbus,
        X        => xbus
    );

    -- Clock generator (SMCLK) 7.3725 MHz
    smclk <= not smclk after 67.819 ns;

    -- SPI clock generator (SMCLK/4)
    ispi_clk <= not ispi_clk after 271.276 ns;

    -- Reset generator
    p3m(0) <= '1', '0' after 1000 ns;

    -- Test bench circuit
    write:process
    begin
        ispi_cs <= '1';
        ispi_di <= 'Z';
        ispi_do <= '1';
        wait until p3m(0)='0';
        wait for 100 ns;

        -- test bench
        wait;
    end process;

end architecture behavioral;
`;

/** Výchozí isim.tcl nového projektu */
export const DefaultIsimScript = `# sim.tcl : ISIM simulation script
# Copyright (C) 2011 Brno University of Technology,
#                    Faculty of Information Technology
# Author(s): Zdenek Vasicek
#
# LICENSE TERMS
#
# Redistribution and use in source and binary forms, with or without
# modification, are permitted provided that the following conditions
# are met:
# 1. Redistributions of source code must retain the above copyright
#    notice, this list of conditions and the following disclaimer.
# 2. Redistributions in binary form must reproduce the above copyright
#    notice, this list of conditions and the following disclaimer in
#    the documentation and/or other materials provided with the
#    distribution.
# 3. All advertising materials mentioning features or use of this software
#    or firmware must display the following acknowledgement:
#
#      This product includes software developed by the University of
#      Technology, Faculty of Information Technology, Brno and its
#      contributors.
#
# 4. Neither the name of the Company nor the names of its contributors
#    may be used to endorse or promote products derived from this
#    software without specific prior written permission.
#
# This software or firmware is provided ''as is'', and any express or implied
# warranties, including, but not limited to, the implied warranties of
# merchantability and fitness for a particular purpose are disclaimed.
# In no event shall the company or contributors be liable for any
# direct, indirect, incidental, special, exemplary, or consequential
# damages (including, but not limited to, procurement of substitute
# goods or services; loss of use, data, or profits; or business
# interruption) however caused and on any theory of liability, whether
# in contract, strict liability, or tort (including negligence or
# otherwise) arising in any way out of the use of this software, even
# if advised of the possibility of such damage.
#

#Project setup
#========================================
#set TESTBENCH_ENTITY "testbench"
#set ISIM_PRECISION "1 ps"

#Run simulation
#========================================
proc isim_script {} {

    add_divider "Top level FPGA"
    add_wave_label "-color #FFFF00" "reset" /testbench/uut/p3m(0)
    add_wave_label "-color #ff8000" "smclk" /testbench/uut/smclk
    add_wave_label "" "irq" /testbench/uut/x(0)

    add_divider "SPI"
    add_wave_label "" "CLK" /testbench/uut/spi_clk
    add_wave_label "" "CS" /testbench/uut/spi_cs
    add_wave_label "" "DI" /testbench/uut/spi_di
    add_wave_label "" "DO" /testbench/uut/spi_do

    if (0) {
        add_divider "SPI controller"
        add_wave_label "" "CS" /uut/ispi_cs
        add_wave_label "" "DI" /uut/ispi_di
        add_wave_label "" "DI req" /uut/ispi_di_req
        add_wave_label "" "DO" /uut/ispi_do
        add_wave_label "" "DO vld" /uut/ispi_do_vld
    }

    add_divider "APP"
    add_wave_label "-color #FFFF00" "reset" /testbench/uut/fpga_inst/reset
    add_wave_label "-color #FF8000" "clk" /testbench/uut/fpga_inst/clk
    add_wave_label "-radix hex" "X" /testbench/uut/x

    run 10 ms
}
`;
