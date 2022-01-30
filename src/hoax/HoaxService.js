const NotFoundException = require('../error/NotFoundException');
const Hoax = require('../hoax/Hoax');
const User = require('../user/User');
const FileService = require('../file/FileService');
const FileAttactment = require('../file/FileAttachment');
const ForbiddenException = require('../error/ForbiddenException');

const save = async (body, user) => {
  const hoax = {
    content: body.content,
    timestamp: Date.now(),
    userId: user.id
  };
  const { id } = await Hoax.create(hoax);

  if (body.fileAttachment) {
    await FileService.associateFileToHoax(body.fileAttachment, id);
  }
};

const getHoaxes = async (page, size, userId) => {
  let where = {};
  if (userId) {
    const user = await User.findOne({ where: { id: userId } });

    if (!user) {
      throw new NotFoundException('user_not_found');
    }

    where = { id: userId };
  }
  const hoaxesWithCount = await Hoax.findAndCountAll({
    attributes: ['id', 'content', 'timestamp'],
    include: [
      {
        model: User,
        as: 'user',
        attributes: ['id', 'username', 'email', 'image'],
        where: where
      },
      {
        model: FileAttactment,
        as: 'fileAttachment',
        attributes: ['filename', 'fileType']
      }
    ],
    order: [['id', 'DESC']],
    limit: size,
    offset: page * size
  });

  return {
    content: hoaxesWithCount.rows.map((hoaxSequelize) => {
      const haoxAsJSON = hoaxSequelize.get({ plain: true });
      if (haoxAsJSON.fileAttachment === null) {
        delete haoxAsJSON.fileAttachment;
      }
      return haoxAsJSON;
    }),
    page,
    size,
    totalPages: Math.ceil(hoaxesWithCount.count / size)
  };
};

const deleteHoax = async (hoaxId, userId) => {
  const hoaxToBeDeleted = await Hoax.findOne({
    where: { id: hoaxId, userId },
    include: { model: FileAttactment }
  });
  if (!hoaxToBeDeleted) {
    throw new ForbiddenException('unauthorized_hoax_delete');
  }
  const hoaxJSON = hoaxToBeDeleted.get({ plain: true });
  if (hoaxJSON.fileAttachment !== null) {
    await FileService.deleteAttachment(hoaxJSON.fileAttachment.filename);
  }
  await hoaxToBeDeleted.destroy();
};

module.exports = { save, getHoaxes, deleteHoax };
