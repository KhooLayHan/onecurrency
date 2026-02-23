import { defineRelations } from "drizzle-orm";
import { accounts } from "./accounts";
import { kycStatuses } from "./kyc-statuses";
import { roles } from "./roles";
import { sessions } from "./sessions";
import { userRoles } from "./user-roles";
import { users } from "./users";
import { verifications } from "./verifications";

export const relations = defineRelations(
  {
    kycStatuses,
    roles,
    userRoles,
    users,
    sessions,
    accounts,
    verifications,
  },
  (r) => ({
    users: {
      kycStatus: r.one.kycStatuses({
        from: r.users.kycStatusId,
        to: r.kycStatuses.id,
      }),
      sessions: r.many.sessions(),
      accounts: r.many.accounts(),
      userRoles: r.many.userRoles(),
    },
    sessions: {
      user: r.one.users({
        from: r.sessions.userId,
        to: r.users.id,
      }),
    },
    accounts: {
      account: r.one.users({
        from: r.accounts.userId,
        to: r.users.id,
      }),
    },
    kycStatuses: {
      users: r.many.users(),
    },
    roles: {
      userRoles: r.many.userRoles(),
    },
    userRoles: {
      user: r.one.users({
        from: r.userRoles.userId,
        to: r.users.id,
      }),
      role: r.one.roles({
        from: r.userRoles.roleId,
        to: r.roles.id,
      }),
    },
  })
);
