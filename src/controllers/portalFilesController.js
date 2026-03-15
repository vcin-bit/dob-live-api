const SiteFolder   = require('../models/SiteFolder');
const SiteDocument = require('../models/SiteDocument');
const ClientUser   = require('../models/ClientUser');
const { uploadImage } = require('../utils/r2');
const crypto = require('crypto');

// ── Helpers ──────────────────────────────────────────────────────────────────

async function getClientContext(req) {
  const user = await ClientUser.findById(req.clientUser._id);
  const siteIds = user.siteIds || [];
  const companyId = user.companyId;
  return { user, siteIds, companyId };
}

// ── Folders ──────────────────────────────────────────────────────────────────

// GET /api/portal-files/folders?siteId=
exports.getFolders = async (req, res) => {
  try {
    const { companyId, siteIds } = await getClientContext(req);
    const { siteId } = req.query;

    // Validate client has access to this site
    if (siteId && !siteIds.map(String).includes(String(siteId))) {
      return res.status(403).json({ error: 'Access denied to this site' });
    }

    const filter = { companyId };
    if (siteId) filter.siteId = siteId;
    else filter.siteId = { $in: siteIds };

    const folders = await SiteFolder.find(filter).sort({ name: 1 });
    res.json({ folders });
  } catch (err) {
    console.error('getFolders error:', err);
    res.status(500).json({ error: 'Server error' });
  }
};

// POST /api/portal-files/folders
exports.createFolder = async (req, res) => {
  try {
    const { companyId, siteIds } = await getClientContext(req);
    const { siteId, name, description } = req.body;

    if (!siteId || !name) return res.status(400).json({ error: 'siteId and name required' });
    if (!siteIds.map(String).includes(String(siteId))) {
      return res.status(403).json({ error: 'Access denied' });
    }

    const folder = await SiteFolder.create({
      companyId,
      siteId,
      name: name.trim(),
      description: description || '',
      createdBy: req.clientUser.email,
    });

    res.status(201).json({ folder });
  } catch (err) {
    console.error('createFolder error:', err);
    res.status(500).json({ error: 'Server error' });
  }
};

// DELETE /api/portal-files/folders/:id
exports.deleteFolder = async (req, res) => {
  try {
    const { companyId } = await getClientContext(req);
    const folder = await SiteFolder.findOne({ _id: req.params.id, companyId });
    if (!folder) return res.status(404).json({ error: 'Folder not found' });

    // Delete all documents in folder
    await SiteDocument.deleteMany({ folderId: folder._id });
    await folder.deleteOne();

    res.json({ message: 'Folder and contents deleted' });
  } catch (err) {
    console.error('deleteFolder error:', err);
    res.status(500).json({ error: 'Server error' });
  }
};

// ── Documents ────────────────────────────────────────────────────────────────

// GET /api/portal-files/documents?folderId=
exports.getDocuments = async (req, res) => {
  try {
    const { companyId } = await getClientContext(req);
    const { folderId } = req.query;
    if (!folderId) return res.status(400).json({ error: 'folderId required' });

    const folder = await SiteFolder.findOne({ _id: folderId, companyId });
    if (!folder) return res.status(403).json({ error: 'Access denied' });

    const docs = await SiteDocument.find({ folderId }).sort({ name: 1 });
    res.json({ documents: docs });
  } catch (err) {
    console.error('getDocuments error:', err);
    res.status(500).json({ error: 'Server error' });
  }
};

// POST /api/portal-files/documents/upload
exports.uploadDocument = async (req, res) => {
  try {
    const { companyId, siteIds } = await getClientContext(req);
    const { folderId, fileName, fileData, mimeType } = req.body;

    if (!folderId || !fileName || !fileData) {
      return res.status(400).json({ error: 'folderId, fileName and fileData required' });
    }

    const folder = await SiteFolder.findOne({ _id: folderId, companyId });
    if (!folder) return res.status(403).json({ error: 'Access denied' });

    // Generate unique key
    const ext = fileName.split('.').pop() || 'bin';
    const key = `portal-docs/${companyId}/${folderId}/${Date.now()}-${crypto.randomBytes(4).toString('hex')}.${ext}`;

    // Strip data URI if present
    const base64 = fileData.replace(/^data:[^;]+;base64,/, '');

    // Upload to R2
    const r2Url = await uploadImage(base64, mimeType || 'application/octet-stream', key.split('/').pop());

    // Save document record
    const sizeBytes = Math.round(Buffer.from(base64, 'base64').length);
    const doc = await SiteDocument.create({
      companyId,
      siteId: folder.siteId,
      folderId,
      name: fileName,
      originalName: fileName,
      mimeType: mimeType || 'application/octet-stream',
      size: sizeBytes,
      r2Key: key,
      r2Url,
      uploadedBy: req.clientUser.email,
    });

    res.status(201).json({ document: doc });
  } catch (err) {
    console.error('uploadDocument error:', err);
    res.status(500).json({ error: 'Server error: ' + err.message });
  }
};

// DELETE /api/portal-files/documents/:id
exports.deleteDocument = async (req, res) => {
  try {
    const { companyId } = await getClientContext(req);
    const doc = await SiteDocument.findOne({ _id: req.params.id, companyId });
    if (!doc) return res.status(404).json({ error: 'Document not found' });
    await doc.deleteOne();
    res.json({ message: 'Document deleted' });
  } catch (err) {
    console.error('deleteDocument error:', err);
    res.status(500).json({ error: 'Server error' });
  }
};
