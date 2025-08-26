const sendToken = (user, statusCode, res) => {
  const token = user.getJwtToken();

  const options = {
    expires: new Date(Date.now() + 90 * 24 * 60 * 60 * 1000),
    httpOnly: false,
    sameSite: "None",
    secure: false,
  };

  res.status(statusCode).cookie("u_token", token, options).json({
    success: true,
    user,
    token,
  });
};

export default sendToken;
