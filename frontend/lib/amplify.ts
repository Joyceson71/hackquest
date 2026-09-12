import { Amplify } from 'aws-amplify';

const userPoolId = process.env.NEXT_PUBLIC_USER_POOL_ID || 'us-east-1_xxxxxxxxx';
const userPoolClientId = process.env.NEXT_PUBLIC_USER_POOL_CLIENT_ID || 'xxxxxxxxxxxxxxxxxxxxxxxxxx';

export function configureAmplify() {
  Amplify.configure({
    Auth: {
      Cognito: {
        userPoolId,
        userPoolClientId,
      },
    },
  });
}
