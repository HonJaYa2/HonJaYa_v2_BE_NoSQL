//express는 async/await문법을 정식으로 지원하진 않기 때문에,
//해당 문법을 사용한 비동기 작업 중 발생한 에러를 제대로 잡기위해
//추가적인 라이브러리(express-async-errors) 설치가 필요
//koa는 정식으로 async/await 문법이 지원됨
import Koa from "koa";
import Router from "koa-router";
import bodyParser from "koa-bodyparser";
import websocketify from "koa-websocket";
import mongoose from "mongoose";
// import fetch from "node-fetch";
import axios from "axios";
import { WebSocketServer } from 'ws';

import qs from "qs";
import cors from "@koa/cors";
import User from "./models/User.js";
import MatchingPool from "./models/MatchingPool.js";

const app = websocketify(new Koa());
const router = new Router();

app.use(cors());

mongoose.connect("mongodb://localhost:27017/honjaya2", {

});
const db = mongoose.connection;
db.on("error", console.error.bind(console, "MongoDB connection error:"));

app.use(bodyParser());
app.use(router.routes()).use(router.allowedMethods());

const getToken = async (auth_code) => {
  try {
    const response = await axios.post(
      "https://kauth.kakao.com/oauth/token",
      qs.stringify({
        grant_type: "authorization_code",
        client_id: "f80b172c8fd2c4405878f3227740f910",
        client_secret: "qOvMqL5ksCA74HfLsBkLf6A7LLTWAYcs",
        redirect_uri: "http://localhost:3000/landing/authcallback",
        code: auth_code,
      }),
      {
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
        },
      }
    );
    const data = response.data;
    if (response.status !== 200) {
      throw new Error(
        `Error: ${data.error}, Description: ${data.error_description}`
      );
    }
    console.log(data);
    return data;
  } catch (e) {
    console.error("ㅁㄴㅇㄹㅁㄴㅇㄹ" + e);
    throw new Error("Failed to fetch token");
  }
};

const getUserInfo = async (accessToken) => {
  try {
    const response = await axios.post(
      "https://kapi.kakao.com/v2/user/me",
      qs.stringify({
        property_keys: JSON.stringify([
          "kakao_account.profile.nickname",
          "kakao_account.profile.profile_image_url",
        ]),
      }),
      {
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/x-www-form-urlencoded",
        },
      }
    );

    const userInfo = response.data;
    console.log(userInfo);
    return userInfo;
  } catch (e) {
    console.error("Error fetching user info: " + e);
    throw new Error("Failed to fetch user info");
  }
};


router.post("/user/getInfo", async (ctx) => {
    const { matchedUserId } = ctx.request.body;
    console.log(matchedUserId);
    if (!matchedUserId) {
        ctx.status = 400;
        ctx.body = { error: "유저 ID 값 필요" };
        return;
      }
    try {
        const user = await User.find({ userId: matchedUserId }, '-password -matchedUser');

        console.log(user);
        ctx.status = 200;
        ctx.body = { matchedUser: user };
    } catch (e) {
        ctx.status = 500;
        console.log("찾는 유저 없음")
        ctx.body = { error: e.message };
    }
})


//토큰 받아오기 & 유저 정보 받아오기(분리?)
router.post("/token", async (ctx) => {
  const { auth_code } = ctx.request.body;
  if (!auth_code) {
    ctx.status = 400;
    ctx.body = { error: "인증 코드 필요" };
    return;
  }

  try {
    const tokenData = await getToken(auth_code);
    const userInfo = await getUserInfo(tokenData.access_token);

    const user = await User.find({ userId: userInfo.id });
    console.log(user);

    if (user.length === 0) {
      const UserData = new User({
        userId: userInfo.id,
        userName: userInfo.kakao_account.profile.nickname,
        profileImage: userInfo.kakao_account.profile.profile_image_url,
      });
      await UserData.save();
      console.log("User saved:", UserData);
      ctx.status = 200;
      ctx.body = { access_token: tokenData.access_token, userInfo: UserData };
    } else {
      console.log("Already exist" + user.userId);
      ctx.status = 200;
    }

    // console.log("userInfo: " + userInfo.kakao_account.profile.nickname)
    // const UserData = new User({
    //     userName: userInfo.kakao_account.profile.nickname,
    //     profileImage: userInfo.kakao_account.profile.profile_image_url,
    // });

    // await UserData.save();
    // console.log("User saved:", UserData);

    // ctx.status = 200;
    // ctx.body = { access_token: tokenData.access_token, user_info: userInfo };
  } catch (e) {
    ctx.status = 500;
    ctx.body = { error: e.message };
  }
});

router.post("/user/setInfo", async (ctx) => {
  const { userId, userData } = ctx.request.body;
  if (!userId || !userData) {
    ctx.status = 400;
    ctx.body = { error: "요청 Body 값 필요" };
    return;
  }

  try {
    const user = await User.findOne({ userId: userId });
    console.log(userData);
    console.log(user);
    if (user) {
      user.birthday = userData.birthday;
      user.gender = userData.gender;

      user.height = userData.height;
      user.weight = userData.weight;
      user.mbti = userData.mbti;

      user.religion = userData.religion;
      user.drinkAmount = userData.drinkAmount;
      user.smoke = userData.smoke;
      user.address = userData.address;

      await user.save();

      ctx.status = 200;
      console.log(user);
    } else {
      ctx.status = 404;
      ctx.body = { message: "User not found" };
    }
  } catch (e) {
    ctx.status = 500;
    ctx.body = { error: e.message };
  }
});

//매칭 요청 유저가

//1.남자인 경우
//1-1. 매칭 풀(여자 유저만 존재)에서 자신의 이상형 조건에 부합하는 유저가 있다면 한 명 추출
//1-1-a.추출한 유저의 조건에 요청 유저가 부합하는지 확인
//1-1-a-ㄱ.서로의 조건에 모두 부합하면 각각의 matchedUser 필드에 집어넣기
//1-1-b.조건에 부합하지 않으면 1-1로 돌아감

//1-2. 매칭 풀에 자신의 이상형 조건에 부합하는 유저가 없다면 10초가 대기(웹소켓)
//1-2. 이후 과정은 1-1과 같음
//1-3-a. 서로의 matchedUser필드까지 업데이트가 끝났다면 클라이언트로 매칭된 유저 정보 반환
//1-3-b. 10초가 지날 때까지 매칭되지 않으면 실패 메시지 반환

//2. 여자인 경우
//2-1. 매칭 풀에 유저의 _id 필드(고유값) 넣기
//2-1-a. 매칭 풀이 존재하면 그냥 삽입
//2-1-b. 매칭 풀이 존재하지 않는 경우(요청 첫 유저인 경우) 매칭 풀 생성 후 삽입
//2-2. 유저의 id값에 따른 User 다큐먼트값을 찾아서 matchedUser 필드값의 변화를 탐지(10초)
//2-2. (남자 쪽에서 매칭 성공하면 여성 유저의 matchedUser 필드값도 변화하게 된다)
//2-3-a. matchedUser필드값 변화시 해당 유저의 정보를 클라이언트로 반환
//2-3-b. matchedUSer필드값이 10초가 지나도 변화없다면 실패 메시지 반환

const findMatchingUserFromMale = async (requestUser) => {
    console.log("here");
  const idealType = requestUser.idealType;
  //첫번째 다큐먼트의 users 필드값을 가져온다
  const matchingPool = await MatchingPool.findOne({}).populate("users");

  if (!matchingPool || !matchingPool.users.length) {
    console.log("no matching pool")
    return null;
  }
  console.log(matchingPool)
  return matchingPool.users[0]
  const extractedUsers = await User.aggregate([
    {
      $match: {
        _id: {
          $in: matchingPool.users.map((user) =>
            new mongoose.Types.ObjectId(user._id)
          ),
        },
        age: { $gte: idealType.minAge, $lte: idealType.maxAge },
        height: { $gte: idealType.minHeight, $lte: idealType.maxHeight },
        weight: { $gte: idealType.minWeight, $lte: idealType.maxWeight },
        mbti: idealType.mbti,
        religion: idealType.religion,
        drinkAmount: idealType.drinkAmount,
        smoke: idealType.smoke,
        userId: {
          $nin: requestUser.matchedUser.map((matched) => matched.userId),
        },
      },
    },
  ]);
  console.log(extractedUsers)
  for (let user of extractedUsers) {
    const userIdealType = user.idealType;
    if (
      requestUser.age >= userIdealType.minAge &&
      requestUser.age <= userIdealType.maxAge &&
      requestUser.height >= userIdealType.minHeight &&
      requestUser.height <= userIdealType.maxHeight &&
      requestUser.weight >= userIdealType.minWeight &&
      requestUser.weight <= userIdealType.maxWeight &&
      requestUser.mbti === userIdealType.mbti &&
      requestUser.religion === userIdealType.religion &&
      requestUser.drinkAmount === userIdealType.drinkAmount &&
      requestUser.smoke === userIdealType.smoke &&
      !user.matchedUser.some((matched) => matched.userId === requestUser.userId)
    ) {
      return user;
    }
  }

  return null;
};

router.post("/matching", async (ctx) => {
  const { requestUserId, idealType } = ctx.request.body;

  if (!idealType || !requestUserId) {
    ctx.status = 400;
    ctx.body = { error: "요청 Body 값 필요" };
    return;
  }

  try {
    //매칭 요청 유저 다큐멘트에 이상형 조건 데이터 넣기
    const requestUser = await User.findOne({ userId: requestUserId });

    if (requestUser.length <= 0) {
      ctx.status = 404;
      ctx.body = { message: "유저 없음" };
    }
    requestUser.idealType = idealType;
    await requestUser.save();

    //웹소켓 서버 열기(무작위 포트)
    const wss = new WebSocketServer({ port: 0 });
    const port = wss.address().port;

    wss.on("connection", (ws) => {
      console.log("WebSocket connection established");

      //메시지 리스너 설정
      ws.on("message", async (message) => {
        const { type, data } = JSON.parse(message);

        //클라이언트에서 join 타입의 메시지가 오면
        if (type === "join") {
          const { userId } = data;
          const user = await User.findOne({ userId });

          //매칭 요청 유저가 여성일 경우
          if (user.gender === "여성") {
            //매칭 풀 생성 후 추가(이미 존재하면 그대로 추가)
            let matchingPool = await MatchingPool.findOne({});
            if (!matchingPool) {
              matchingPool = new MatchingPool({ users: [user._id] });
              await matchingPool.save();
            } else {
              matchingPool.users.push(user._id);
            }

            //매칭 요청 유저의 matchedUser 필드값에 대한 감지(1초 주기로 확인)
            //(실시간은 아님 => 실시간 구현을 위해서는 DB 트리거 or Redis or 웹소켓 이벤트 사용해야함)
            //필드값(배열 형태)길이 변화 생기면 탐지
            let previousMatchedUserLength = user.matchedUser.length;
            const checkForMatchInterval = setInterval(async () => {
              const updatedUser = await User.findById(user._id);
              if (updatedUser.matchedUser.length > previousMatchedUserLength) {
                clearInterval(checkForMatchInterval);
                //클라이언트로 매칭된 유저 정보 반환하고 서버 닫기
                ws.send(
                  JSON.stringify({
                    type: "match",
                    matchedUserId: updatedUser.matchedUser[0].userId,
                  })
                );
                ws.close();
              }
            }, 1000);

            setTimeout(() => {
              clearInterval(checkForMatchInterval);
              ws.send(JSON.stringify({ type: "timeout" }));
              ws.close();
            }, 20000);

            //----DB 트리거를 사용하면 아래와 같다----
            //   const changeStream = User.watch([
            //     { $match: { 'fullDocument._id': mongoose.Types.ObjectId(user._id) } }
            //   ]);

            //   changeStream.on('change', (change) => {
            //     if (change.updateDescription.updatedFields['matchedUser']) {
            //       const newMatchedUser = change.updateDescription.updatedFields['matchedUser'].pop();
            //       ws.send(JSON.stringify({ type: 'match', matchedUser: newMatchedUser }));
            //       ws.close(); // 매칭이 완료되면 WebSocket 연결 종료
            //       changeStream.close(); // Change Stream 닫기
            //     }
            //   });

            //   setTimeout(() => {
            //     changeStream.close(); // 타임아웃되면 Change Stream 닫기
            //     ws.send(JSON.stringify({ type: 'timeout' }));
            //     ws.close(); // 타임아웃되면 WebSocket 연결 종료
            //   }, 10000);
          }

          if (user.gender === "남성") {
            const waitForMatch = async () => {
              return new Promise((resolve, reject) => {
                const checkForMatch = setInterval(async () => {
                  const userWhoMatched = await findMatchingUserFromMale(user);
                  if (userWhoMatched) {
                    if (!user.matchedUser.some((matched) => matched.userId === userWhoMatched.userId)) {
                    user.matchedUser.unshift({
                      userId: userWhoMatched.userId,
                      matchedTime: Date.now(),
                    });
                    userWhoMatched.matchedUser.unshift({
                      userId: user.userId,
                      matchedTime: Date.now(),
                    });

                    await user.save();
                    await userWhoMatched.save();
                }
                    clearInterval(checkForMatch);
                    resolve(userWhoMatched);
                  }
                }, 1000);

                setTimeout(() => {
                  clearInterval(checkForMatch);
                  resolve(null);
                }, 20000);
              });
            };

            const userWhoMatched = await waitForMatch();

            if (userWhoMatched) {
              ws.send(
                JSON.stringify({
                  type: "match",
                  matchedUserId: userWhoMatched.userId,
                })
              );
            } else {
              ws.send(JSON.stringify({ type: "timeout" }));
            }
            ws.close();
          }
        }
      });
    });

    ctx.status = 200;
    ctx.body = {
      message: "매칭 중",
      requestUserId: requestUser.userId,
      wsPort: port,
    };
  } catch (e) {
    ctx.status = 500;
    console.log(e);
    ctx.body = { error: e.message };
  }
});

const port = 8080;
app.listen(port, () => {
  console.log(`Server running on http://localhost:${port}`);
});
