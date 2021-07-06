import {Router, Request, Response} from 'express';
import {FeedItem} from '../models/FeedItem';
import {NextFunction} from 'connect';
import * as jwt from 'jsonwebtoken';
import * as AWS from '../../../../aws';
import * as c from '../../../../config/config';

const router: Router = Router();

export function requireAuth(req: Request, res: Response, next: NextFunction) {
  if (!req.headers || !req.headers.authorization) {
    console.log(new Date().toLocaleString() + `: UDAGRAM-FEED: No authorization headers.` ); //Logging
    return res.status(401).send({message: 'No authorization headers.'});
  }

  const tokenBearer = req.headers.authorization.split(' ');
  if (tokenBearer.length != 2) {
    console.log(new Date().toLocaleString() + `: UDAGRAM-FEED: Malformed token.` ); //Logging
    return res.status(401).send({message: 'Malformed token.'});
  }

  const token = tokenBearer[1];
  return jwt.verify(token, c.config.jwt.secret, (err, decoded) => {
    if (err) {
      console.log(new Date().toLocaleString() + `: UDAGRAM-FEED: Failed to authenticate.` ); //Logging
      return res.status(500).send({auth: false, message: 'Failed to authenticate.'});
    }
    return next();
  });
}

// Get all feed items
router.get('/', async (req: Request, res: Response) => {
  const items = await FeedItem.findAndCountAll({order: [['id', 'DESC']]});
  items.rows.map((item) => {
    if (item.url) {
      item.url = AWS.getGetSignedUrl(item.url);
    }
  });
  res.send(items);

  console.log(new Date().toLocaleString() + `: UDAGRAM-FEED: Get all feed items: ${JSON.stringify(items)}` ); //Logging
});

// Get a feed resource
router.get('/:id',
    async (req: Request, res: Response) => {
      const {id} = req.params;
      const item = await FeedItem.findByPk(id);
      res.send(item);

      console.log(new Date().toLocaleString() + `: UDAGRAM-FEED: Get information for feed ${id}: ${JSON.stringify(item)}`); //Logging
    });

// Get a signed url to put a new item in the bucket
router.get('/signed-url/:fileName',
    requireAuth,
    async (req: Request, res: Response) => {
      const {fileName} = req.params;
      const url = AWS.getPutSignedUrl(fileName);
      res.status(201).send({url: url});
      console.log(new Date().toLocaleString() + `: UDAGRAM-FEED: Get a signed URL.` ); //Logging
    });

// Create feed with metadata
router.post('/',
    requireAuth,
    async (req: Request, res: Response) => {
      const caption = req.body.caption;
      const fileName = req.body.url; // same as S3 key name

      if (!caption) {
        console.log(new Date().toLocaleString() + `: UDAGRAM-FEED: Caption is required or malformed.` ); //Logging
        return res.status(400).send({message: 'Caption is required or malformed.'});
      }

      if (!fileName) {
        console.log(new Date().toLocaleString() + `: UDAGRAM-FEED: File url is required.` ); //Logging
        return res.status(400).send({message: 'File url is required.'});
      }

      const item = await new FeedItem({
        caption: caption,
        url: fileName,
      });

      const savedItem = await item.save();

      savedItem.url = AWS.getGetSignedUrl(savedItem.url);
      res.status(201).send(savedItem);

      console.log(new Date().toLocaleString() + `: UDAGRAM-FEED: Create feed item with caption ${caption} and fileName ${fileName}` ); //Logging
    });

export const FeedRouter: Router = router;
