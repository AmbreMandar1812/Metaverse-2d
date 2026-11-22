import { request, Router } from "express";
import { UpdateMetadataSchema , DeleteUserSchema} from "../../types";
import client from "@repo/db/client";
import { userMiddleware } from "../../middleware/user";
import { adminMiddleware } from "../../middleware/admin";
import { string } from "zod/v4";

export const userRouter = Router();

userRouter.post("/metadata", userMiddleware, async (req, res) => {
    const parsedData = UpdateMetadataSchema.safeParse(req.body)       
    if (!parsedData.success) {
        console.log("parsed data incorrect")
        res.status(400).json({message: "Validation failed"})
        return
    }
    try {
        await client.user.update({
            where: {
                id: req.userId
            },
            data: {
                avatarId: parsedData.data.avatarId
            }
        })
        res.json({message: "Metadata updated"})
    } catch(e) {
        console.log("error")
        res.status(400).json({message: "Internal server error"})
    }
})

userRouter.get("/metadata/bulk", async (req, res) => {
    const userIdString = (req.query.ids ?? "[]") as string;
    const userIds = (userIdString).slice(1, userIdString?.length - 1).split(",");
    console.log(userIds)
    const metadata: Array<{
        id: string;
        avatar?: {
            imageUrl: string | null;
        } | null;
    }> = await client.user.findMany({
        where: {
            id: {
                in: userIds
            }
        }, select: {
            avatar: true,
            id: true
        }
    })

    res.json({
        avatars: metadata.map((m: {
            id: string;
            avatar?: {
                imageUrl: string | null;
            } | null;
        }) => ({
            userId: m.id,
            avatarId: m.avatar?.imageUrl ?? null
        }))
    })
})

userRouter.get("/metadata", async (req,res) => {
    const users = await client.user.findMany({
        select: {
            id: true,
            username  :true,
            password : true,
            role : true,
            spaces: true
        }
    })
    res.json(users)
})

userRouter.delete("/metadata/:id", userMiddleware,  async (req, res) => {
    console.log("inside route")
    const parsedData = DeleteUserSchema.safeParse(req.params)
    if (!parsedData.success) {
        console.log("parsed data incorrect")
        res.status(400).json({message: "Validation failed"})
        return
    }
    console.log("inside specific endpoint")
    const user = await client.user.findUnique({
        where : {
            id : String(req.params.id)
        },select: {
            spaces : true
        }
    })
    if (!user) {
        res.status(404).json({message: "User not found"})
        return
    }
    const u = await client.$transaction( async () => {
        if(user.spaces.length > 0){
            user.spaces.map(async (m : 
                {
                    id: string;
                }
            ) => {
                await client.spaceElements.deleteMany({
                    where: {
                        spaceId : m.id
                    }
                })
            })
            await client.space.deleteMany({
                where : {
                    creatorId : String(req.params.id)
                }
            })
        }
        const deleted_user = await client.user.delete({
            where : {
                id : String(req.params.id)
            }
        })
        res.json({
            message : "The user is deleted",
            deleted_user
        })
    })
})