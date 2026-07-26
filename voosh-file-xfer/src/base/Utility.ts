export class Utility {
    private static CRC32_TABLE: Int32Array = (() => {
        const table = new Int32Array(256);
        for (let i = 0; i < 256; i++) {
            let crc = i;
            for (let j = 0; j < 8; j++) {
                crc = (crc & 1) ? (0xEDB88320 ^ (crc >>> 1)) : (crc >>> 1);
            }
            table[i] = crc;
        }
        return table;
    })();

    private static async calculateCRC32Stream(stream: ReadableStream<Uint8Array>): Promise<string> {
        let crc = 0xFFFFFFFF; // Initial value
        const reader = stream.getReader();
        
        try {
            while (true) {
                const { done, value: buffer } = await reader.read();
                if (done) break;

                // Update the CRC value byte-by-byte for the current chunk
                for (let i = 0; i < buffer.length; i++) {
                    crc = (crc >>> 8) ^ Utility.CRC32_TABLE[(crc ^ buffer[i]) & 0xFF];
                }
            }
            // Final XOR and convert to unsigned hex string
            const finalCrc = (crc ^ 0xFFFFFFFF) >>> 0;
            return finalCrc.toString(16).toUpperCase().padStart(8, '0');
        } finally {
            // Ensure the stream reader is properly released
            reader.releaseLock();
        }
    }

    public static async calculateReceiveCode(file?: File): Promise<string | undefined> {
        if (!file) return undefined;
        if (file.size === 0) return '';
        return await Utility.calculateCRC32Stream(file.stream());
    }

    public static async getRef(file?: File) : Promise<string | undefined> {
        if (!file) return undefined;
        if (file.size === 0) return '';
        const crc32 = await Utility.calculateCRC32Stream(file.stream());
        let crcNumber = parseInt(crc32, 16);
        if (crcNumber === 0) return '0';

        const alphabet = "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz";
        const base62Digit = [];

        while (Math.floor(crcNumber) > 0) {
            const remainder = crcNumber % 62;
            base62Digit.push(alphabet.charAt(remainder));
            crcNumber /= 62;
        }
        return base62Digit.reverse().join("");
    }
}
