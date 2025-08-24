
// This file is intentionally left empty.
// The custom server in `server.ts` now handles the Socket.IO setup.
import { type NextApiRequest, type NextApiResponse } from 'next';

const handler = (req: NextApiRequest, res: NextApiResponse) => {
    res.status(200).json({ message: 'Socket is handled by the custom server.' });
}

export default handler;
