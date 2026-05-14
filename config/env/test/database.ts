export default () => ({
  connection: {
    client: 'sqlite',
    connection: {
      filename: '.tmp/test.db',
    },
    useNullAsDefault: true,
  },
});
