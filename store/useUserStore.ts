import type { User } from "../utils/types"
import { produce } from "immer"
import { createTrackedSelector } from "react-tracked"
import { create } from "zustand"
import { createJSONStorage, persist } from "zustand/middleware"
import { getUserMe } from "../utils/request"

interface UserState {
  user: User
  accessToken: string
  fetch: () => Promise<void>
  setName: (name: string) => void
  setAccessToken: (accessToken: string) => void
  logout: () => void
}

export const useUserStore = create<UserState>()(
  persist(
    (set, get) => ({
      user: {} as User,
      accessToken: "",
      fetch: async () => {
        try {
          const user = await getUserMe(get().accessToken)
          set({ user })
        } catch (e) {
          console.warn(e)
          throw e
        }
      },
      setName: (name: string) =>
        set(produce((state: UserState) => {
          state.user.name = name
        })),
      setAccessToken: (accessToken: string) => set({ accessToken }),
      logout: () => set({ user: {} as User, accessToken: "" }),
    }),
    {
      name: "user",
      storage: createJSONStorage(() => localStorage),
      partialize: state => ({
        user: state.user,
        accessToken: state.accessToken,
      }),
    },
  ),
)

export const useTrackedUserStore = createTrackedSelector(useUserStore)
