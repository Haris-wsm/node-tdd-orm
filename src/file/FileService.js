const fs = require('fs');
const path = require('path');
const config = require('config');
const FileType = require('file-type');
const { randomString } = require('../shared/generator');
const FileAttactment = require('./FileAttachment');
const { uploadDir, profileDir, attachmentDir } = config;
const profileFolder = path.join('.', uploadDir, profileDir);
const attachmentsFolder = path.join('.', uploadDir, attachmentDir);

const Sequelize = require('sequelize');
const Hoax = require('../hoax/Hoax');

const createFolders = () => {
  if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir);

  if (!fs.existsSync(profileFolder)) fs.mkdirSync(profileFolder);

  if (!fs.existsSync(attachmentsFolder)) fs.mkdirSync(attachmentsFolder);
};

const saveProfileImage = async (base64File) => {
  const filename = randomString(32);
  const filePath = path.join(profileFolder, filename);

  await fs.promises.writeFile(filePath, base64File, { encoding: 'base64' });
  return filename;
};

const deleteProfileImage = async (filename) => {
  const filePath = path.join(profileFolder, filename);
  await fs.promises.unlink(filePath);
};

const isLessThan2MB = (buffer) => {
  return buffer.length < 2 * 1024 * 1024;
};

const isSupportedFileType = async (buffer) => {
  const type = await FileType.fromBuffer(buffer);

  return !type
    ? false
    : type.mime === 'image/png' || type.mime === 'image/jpeg'
    ? true
    : false;
};

const saveAttachment = async (file) => {
  const type = await FileType.fromBuffer(file.buffer);

  let fileType;
  let filename = randomString(32);
  if (type) {
    fileType = type.mime;
    filename += `.${type.ext}`;
  }
  await fs.promises.writeFile(
    path.join(attachmentsFolder, filename),
    file.buffer
  );
  const savedAttachment = await FileAttactment.create({
    filename,
    uploadDate: new Date(),
    fileType: fileType
  });

  return { id: savedAttachment.id };
};

const associateFileToHoax = async (attachmentId, hoaxId) => {
  const attachment = await FileAttactment.findOne({
    where: { id: attachmentId }
  });
  if (!attachment) {
    return;
  }
  if (attachment.hoaxId) {
    return;
  }
  attachment.hoaxId = hoaxId;
  await attachment.save();
};

const removeUnusedAttachments = async () => {
  const ONE_DAY = 24 * 60 * 60 * 1000;

  setInterval(async () => {
    const oneDayOld = new Date(Date.now() - ONE_DAY);
    const attachments = await FileAttactment.findAll({
      where: {
        uploadDate: { [Sequelize.Op.lt]: oneDayOld },
        hoaxId: {
          [Sequelize.Op.is]: null
        }
      }
    });

    for (attachment of attachments) {
      const { filename } = attachment.get({ plain: true });
      await fs.promises.unlink(path.join(attachmentsFolder, filename));
      await attachment.destroy();
    }
  }, ONE_DAY);
};
const deleteAttachment = async (filename) => {
  const filePath = path.join(attachmentsFolder, filename);
  try {
    await fs.promises.access(filePath);
    await fs.promises.unlink(filePath);
  } catch (error) {}
};

const deleteUserFiles = async (user) => {
  if (user.image) {
    await deleteProfileImage(user.image);
  }

  const attachments = await FileAttactment.findAll({
    attributes: ['filename'],
    include: {
      model: Hoax,
      where: {
        userId: user.id
      }
    }
  });

  if (attachments.length === 0) {
    return;
  }

  for (let attachment of attachments) {
    deleteAttachment(attachment.getDataValue('filename'));
  }
};

module.exports = {
  createFolders,
  saveProfileImage,
  deleteProfileImage,
  isLessThan2MB,
  isSupportedFileType,
  saveAttachment,
  associateFileToHoax,
  removeUnusedAttachments,
  deleteAttachment,
  deleteUserFiles
};
