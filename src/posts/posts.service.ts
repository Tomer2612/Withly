import { Injectable, InternalServerErrorException, NotFoundException, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../users/prisma.service';
import { CommunitiesService } from '../communities/communities.service';

@Injectable()
export class PostsService {
  constructor(
    private prisma: PrismaService,
    private communitiesService: CommunitiesService,
  ) {}

  async create(
    content: string, 
    authorId: string, 
    communityIdOrSlug: string, 
    title?: string, 
    images?: string[],
    files?: { url: string; name: string }[],
    links?: string[],
    category?: string,
    videos?: string[]
  ) {
    try {
      // Resolve slug to actual community ID
      const communityId = await this.communitiesService.resolveId(communityIdOrSlug);
      
      return await this.prisma.post.create({
        data: { 
          title, 
          content, 
          images: images || [],
          videos: videos || [],
          files: files || [],
          links: links || [],
          category,
          authorId, 
          communityId 
        },
        include: {
          author: {
            select: { id: true, email: true, name: true, profileImage: true },
          },
          _count: {
            select: { likes: true, comments: true, savedBy: true },
          },
        },
      });
    } catch (err) {
      console.error('Post creation failed:', err);
      throw new InternalServerErrorException('Could not create post');
    }
  }

  async findByCommunity(communityIdOrSlug: string, userId?: string) {
    // Resolve slug to actual community ID
    const communityId = await this.communitiesService.resolveId(communityIdOrSlug);
    
    const posts = await this.prisma.post.findMany({
      where: { communityId },
      orderBy: [
        { isPinned: 'desc' },  // Pinned posts first
        { pinnedAt: 'desc' },  // Most recently pinned first among pinned
        { createdAt: 'desc' }, // Then by creation date
      ],
      include: {
        author: {
          select: { id: true, email: true, name: true, profileImage: true },
        },
        _count: {
          select: { likes: true, comments: true, savedBy: true },
        },
        likes: userId ? {
          where: { userId },
          select: { id: true },
        } : false,
        savedBy: userId ? {
          where: { userId },
          select: { id: true },
        } : false,
        poll: {
          include: {
            options: {
              orderBy: { id: 'asc' },
              include: {
                _count: {
                  select: { votes: true },
                },
                votes: userId ? {
                  where: { oderId: userId },
                  select: { id: true },
                } : false,
              },
            },
          },
        },
      },
    });

    // Transform to include isLiked and isSaved booleans
    return posts.map(post => {
      // Transform poll data if exists
      let pollData: {
        id: string;
        question: string;
        expiresAt: Date | null;
        totalVotes: number;
        userVotedOptionId: string | null;
        options: { id: string; text: string; votes: number; percentage: number }[];
      } | null = null;
      if (post.poll) {
        const totalVotes = post.poll.options.reduce((sum, opt) => sum + (opt._count?.votes || 0), 0);
        pollData = {
          id: post.poll.id,
          question: post.poll.question,
          expiresAt: post.poll.expiresAt,
          totalVotes,
          userVotedOptionId: userId 
            ? post.poll.options.find(opt => (opt.votes as any[])?.length > 0)?.id || null 
            : null,
          options: post.poll.options.map(opt => ({
            id: opt.id,
            text: opt.text,
            votes: opt._count?.votes || 0,
            percentage: totalVotes > 0 ? Math.round((opt._count?.votes || 0) / totalVotes * 100) : 0,
          })),
        };
      }

      return {
        ...post,
        isLiked: userId ? (post.likes as any[])?.length > 0 : false,
        isSaved: userId ? (post.savedBy as any[])?.length > 0 : false,
        likes: undefined,
        savedBy: undefined,
        poll: pollData,
      };
    });
  }

  async update(
    postId: string, 
    content: string, 
    userId: string, 
    title?: string,
    images?: string[],
    files?: { url: string; name: string }[],
    links?: string[],
    imagesToRemove?: string[],
    filesToRemove?: string[],
    linksToRemove?: string[],
    pollQuestion?: string,
    pollOptions?: { id: string; text: string }[],
    newPollQuestion?: string,
    newPollOptions?: string[],
    videos?: string[],
    videosToRemove?: string[]
  ) {
    const post = await this.prisma.post.findUnique({
      where: { id: postId },
    });

    if (!post) {
      throw new NotFoundException('Post not found');
    }

    if (post.authorId !== userId) {
      throw new ForbiddenException('You can only edit your own posts');
    }

    const updateData: any = { content, title };
    
    // Handle images - add new ones and remove specified
    if (images || imagesToRemove) {
      const currentImages = (post.images as string[]) || [];
      let newImages = [...currentImages];
      
      // Remove specified images
      if (imagesToRemove && imagesToRemove.length > 0) {
        newImages = newImages.filter(img => !imagesToRemove.includes(img));
      }
      
      // Add new images (up to limit of 6)
      if (images && images.length > 0) {
        newImages = [...newImages, ...images].slice(0, 6);
      }
      
      updateData.images = newImages;
    }
    
    // Handle files - add new ones and remove specified
    if (files || filesToRemove) {
      const currentFiles = (post.files as { url: string; name: string }[]) || [];
      let newFiles = [...currentFiles];
      
      // Remove specified files
      if (filesToRemove && filesToRemove.length > 0) {
        newFiles = newFiles.filter(file => !filesToRemove.includes(file.url));
      }
      
      // Add new files (up to limit of 6)
      if (files && files.length > 0) {
        newFiles = [...newFiles, ...files].slice(0, 6);
      }
      
      updateData.files = newFiles;
    }
    
    // Handle links - replace with new list (frontend sends kept links + handles removals)
    if (links !== undefined) {
      // Frontend sends the complete list of kept links
      updateData.links = links.slice(0, 10);
    } else if (linksToRemove && linksToRemove.length > 0) {
      // If only removing links (no new links array), filter the existing ones
      const currentLinks = (post.links as string[]) || [];
      updateData.links = currentLinks.filter(link => !linksToRemove.includes(link));
    }

    // Handle videos - add new ones and remove specified
    if (videos || videosToRemove) {
      const currentVideos = (post.videos as string[]) || [];
      let newVideos = [...currentVideos];
      
      if (videosToRemove && videosToRemove.length > 0) {
        newVideos = newVideos.filter(v => !videosToRemove.includes(v));
      }
      
      if (videos && videos.length > 0) {
        newVideos = [...newVideos, ...videos].slice(0, 3);
      }
      
      updateData.videos = newVideos;
    }

    // Handle poll updates
    if (pollQuestion && pollOptions && pollOptions.length > 0) {
      // Check if post has a poll
      const existingPoll = await this.prisma.poll.findFirst({
        where: { postId },
      });
      
      if (existingPoll) {
        // Update poll question
        await this.prisma.poll.update({
          where: { id: existingPoll.id },
          data: { question: pollQuestion },
        });
        
        // Update each option
        for (const option of pollOptions) {
          await this.prisma.pollOption.update({
            where: { id: option.id },
            data: { text: option.text },
          });
        }
      }
    }
    
    // Handle creating a new poll
    if (newPollQuestion && newPollOptions && newPollOptions.length >= 2) {
      // Check if post already has a poll
      const existingPoll = await this.prisma.poll.findFirst({
        where: { postId },
      });
      
      // Only create if no poll exists (max 1 per post)
      if (!existingPoll) {
        await this.prisma.poll.create({
          data: {
            question: newPollQuestion,
            postId,
            options: {
              create: newPollOptions.map(text => ({ text })),
            },
          },
        });
      }
    }

    return this.prisma.post.update({
      where: { id: postId },
      data: updateData,
      include: {
        author: {
          select: { id: true, email: true, name: true, profileImage: true },
        },
        poll: {
          include: {
            options: {
              orderBy: { id: 'asc' },
              include: {
                _count: { select: { votes: true } },
              },
            },
          },
        },
        _count: {
          select: { likes: true, comments: true, savedBy: true },
        },
      },
    });
  }

  async delete(postId: string, userId: string) {
    const post = await this.prisma.post.findUnique({
      where: { id: postId },
    });

    if (!post) {
      throw new NotFoundException('Post not found');
    }

    if (post.authorId !== userId) {
      throw new ForbiddenException('You can only delete your own posts');
    }

    await this.prisma.post.delete({
      where: { id: postId },
    });

    return { message: 'Post deleted successfully' };
  }

  // Like/Unlike toggle
  async toggleLike(postId: string, userId: string) {
    try {
      const existingLike = await this.prisma.like.findFirst({
        where: {
          userId,
          postId,
        },
      });

      if (existingLike) {
        // Unlike
        await this.prisma.like.delete({
          where: { id: existingLike.id },
        });
        return { liked: false, post: null };
      } else {
        // Like - use upsert to handle race conditions
        await this.prisma.like.upsert({
          where: {
            userId_postId: { userId, postId },
          },
          create: { userId, postId },
          update: {}, // No update needed, just ensure it exists
        });
        
        // Get post for notification
        const post = await this.prisma.post.findUnique({
          where: { id: postId },
          select: { authorId: true, communityId: true },
        });
        
        return { liked: true, post };
      }
    } catch (err) {
      console.error('Toggle like error:', err);
      // If there was a race condition and like already exists, treat as success
      if (err.code === 'P2002') {
        return { liked: true, post: null };
      }
      throw err;
    }
  }

  // Get comments for a post
  async getComments(postId: string) {
    return this.prisma.comment.findMany({
      where: { postId },
      orderBy: { createdAt: 'asc' },
      include: {
        user: {
          select: { id: true, email: true, name: true, profileImage: true },
        },
      },
    });
  }

  // Create a comment
  async createComment(postId: string, userId: string, content: string) {
    const comment = await this.prisma.comment.create({
      data: { postId, userId, content },
      include: {
        user: {
          select: { id: true, email: true, name: true, profileImage: true },
        },
        post: {
          select: { authorId: true, communityId: true },
        },
      },
    });
    return comment;
  }

  // Delete a comment
  async deleteComment(commentId: string, userId: string) {
    const comment = await this.prisma.comment.findUnique({
      where: { id: commentId },
    });

    if (!comment) {
      throw new NotFoundException('Comment not found');
    }

    if (comment.userId !== userId) {
      throw new ForbiddenException('You can only delete your own comments');
    }

    await this.prisma.comment.delete({
      where: { id: commentId },
    });

    return { message: 'Comment deleted successfully' };
  }

  // Edit a comment
  async editComment(commentId: string, userId: string, content: string) {
    const comment = await this.prisma.comment.findUnique({
      where: { id: commentId },
    });

    if (!comment) {
      throw new NotFoundException('Comment not found');
    }

    if (comment.userId !== userId) {
      throw new ForbiddenException('You can only edit your own comments');
    }

    return this.prisma.comment.update({
      where: { id: commentId },
      data: { content },
      include: {
        user: {
          select: { id: true, email: true, name: true, profileImage: true },
        },
      },
    });
  }

  // Save/Unsave toggle
  async toggleSave(postId: string, userId: string) {
    try {
      const existingSave = await this.prisma.savedPost.findFirst({
        where: {
          userId,
          postId,
        },
      });

      if (existingSave) {
        // Unsave
        await this.prisma.savedPost.delete({
          where: { id: existingSave.id },
        });
        return { saved: false };
      } else {
        // Save - use upsert to handle race conditions
        await this.prisma.savedPost.upsert({
          where: {
            userId_postId: { userId, postId },
          },
          create: { userId, postId },
          update: {},
        });
        return { saved: true };
      }
    } catch (err) {
      console.error('Toggle save error:', err);
      if (err.code === 'P2002') {
        return { saved: true };
      }
      throw err;
    }
  }

  // Pin/Unpin a post (owner/manager only)
  async togglePin(postId: string, userId: string) {
    const post = await this.prisma.post.findUnique({
      where: { id: postId },
      include: { community: true },
    });

    if (!post) {
      throw new NotFoundException('Post not found');
    }

    // Check if user is owner or manager of the community
    const membership = await this.prisma.communityMember.findUnique({
      where: {
        userId_communityId: { userId, communityId: post.communityId },
      },
    });

    if (!membership || (membership.role !== 'OWNER' && membership.role !== 'MANAGER')) {
      throw new ForbiddenException('Only owners and managers can pin posts');
    }

    // Toggle pin status
    const newPinStatus = !post.isPinned;
    
    return this.prisma.post.update({
      where: { id: postId },
      data: {
        isPinned: newPinStatus,
        pinnedAt: newPinStatus ? new Date() : null,
      },
      include: {
        author: {
          select: { id: true, email: true, name: true, profileImage: true },
        },
        _count: {
          select: { likes: true, comments: true, savedBy: true },
        },
      },
    });
  }

  async getLinkPreview(url: string) {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 10000); // 10 second timeout
      
      const response = await fetch(url, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (compatible; Withly/1.0; +http://withly.co.il)',
        },
        redirect: 'follow',
        signal: controller.signal,
      });
      
      clearTimeout(timeoutId);
      
      if (!response.ok) {
        throw new Error('Failed to fetch URL');
      }
      
      const html = await response.text();
      
      // Extract Open Graph meta tags
      const getMetaContent = (property: string): string | null => {
        const match = html.match(new RegExp(`<meta[^>]*property=["']${property}["'][^>]*content=["']([^"']+)["']`, 'i')) 
          || html.match(new RegExp(`<meta[^>]*content=["']([^"']+)["'][^>]*property=["']${property}["']`, 'i'));
        return match ? match[1] : null;
      };
      
      const getMetaName = (name: string): string | null => {
        const match = html.match(new RegExp(`<meta[^>]*name=["']${name}["'][^>]*content=["']([^"']+)["']`, 'i'))
          || html.match(new RegExp(`<meta[^>]*content=["']([^"']+)["'][^>]*name=["']${name}["']`, 'i'));
        return match ? match[1] : null;
      };
      
      // Get title
      let title = getMetaContent('og:title') || getMetaName('twitter:title');
      if (!title) {
        const titleMatch = html.match(/<title[^>]*>([^<]+)<\/title>/i);
        title = titleMatch ? titleMatch[1].trim() : null;
      }
      
      // Get description
      const description = getMetaContent('og:description') || getMetaName('description') || getMetaName('twitter:description');
      
      // Get image
      let image = getMetaContent('og:image') || getMetaName('twitter:image');
      if (image && !image.startsWith('http')) {
        const urlObj = new URL(url);
        image = image.startsWith('/') ? `${urlObj.origin}${image}` : `${urlObj.origin}/${image}`;
      }
      
      return {
        url,
        title: title || new URL(url).hostname,
        description: description || null,
        image: image || null,
      };
    } catch (err: any) {
      // Silently handle abort errors (expected for slow sites)
      // Return basic fallback without logging
      try {
        const urlObj = new URL(url);
        return {
          url,
          title: urlObj.hostname.replace('www.', ''),
          description: null,
          image: null,
        };
      } catch {
        return { url, title: url, description: null, image: null };
      }
    }
  }

  // Create a poll for a post
  async createPoll(postId: string, userId: string, question: string, options: string[], expiresAt?: Date) {
    // Verify post exists and user is author
    const post = await this.prisma.post.findUnique({
      where: { id: postId },
      include: { poll: true },
    });

    if (!post) {
      throw new NotFoundException('Post not found');
    }

    if (post.authorId !== userId) {
      throw new ForbiddenException('Only the post author can add a poll');
    }

    if (post.poll) {
      throw new ForbiddenException('Post already has a poll');
    }

    if (options.length < 2) {
      throw new ForbiddenException('Poll must have at least 2 options');
    }

    // Create poll with options
    const poll = await this.prisma.poll.create({
      data: {
        question,
        postId,
        expiresAt: expiresAt || null,
        options: {
          create: options.map(text => ({ text })),
        },
      },
      include: {
        options: {
          include: {
            _count: {
              select: { votes: true },
            },
          },
        },
      },
    });

    return {
      id: poll.id,
      question: poll.question,
      expiresAt: poll.expiresAt,
      totalVotes: 0,
      userVotedOptionId: null,
      options: poll.options.map(opt => ({
        id: opt.id,
        text: opt.text,
        votes: 0,
        percentage: 0,
      })),
    };
  }

  // Vote on a poll
  async votePoll(pollId: string, optionId: string, userId: string) {
    // Verify poll exists
    const poll = await this.prisma.poll.findUnique({
      where: { id: pollId },
      include: { options: true },
    });

    if (!poll) {
      throw new NotFoundException('Poll not found');
    }

    // Check if poll has expired
    if (poll.expiresAt && new Date() > poll.expiresAt) {
      throw new ForbiddenException('Poll has expired');
    }

    // Verify option belongs to this poll
    const option = poll.options.find(opt => opt.id === optionId);
    if (!option) {
      throw new NotFoundException('Option not found in this poll');
    }

    // Check if user already voted on this poll
    const existingVote = await this.prisma.pollVote.findFirst({
      where: {
        oderId: userId,
        option: {
          pollId: pollId,
        },
      },
    });

    if (existingVote) {
      // Update vote to new option
      await this.prisma.pollVote.delete({
        where: { id: existingVote.id },
      });
    }

    // Create the vote
    await this.prisma.pollVote.create({
      data: {
        optionId,
        oderId: userId,
      },
    });

    // Return updated poll data
    const updatedPoll = await this.prisma.poll.findUnique({
      where: { id: pollId },
      include: {
        options: {
          orderBy: { id: 'asc' },
          include: {
            _count: {
              select: { votes: true },
            },
            votes: {
              where: { oderId: userId },
              select: { id: true },
            },
          },
        },
      },
    });

    const totalVotes = updatedPoll!.options.reduce((sum, opt) => sum + (opt._count?.votes || 0), 0);

    return {
      id: updatedPoll!.id,
      question: updatedPoll!.question,
      expiresAt: updatedPoll!.expiresAt,
      totalVotes,
      userVotedOptionId: optionId,
      options: updatedPoll!.options.map(opt => ({
        id: opt.id,
        text: opt.text,
        votes: opt._count?.votes || 0,
        percentage: totalVotes > 0 ? Math.round((opt._count?.votes || 0) / totalVotes * 100) : 0,
      })),
    };
  }

  // Remove vote from a poll
  async removeVote(pollId: string, userId: string) {
    // Verify poll exists
    const poll = await this.prisma.poll.findUnique({
      where: { id: pollId },
    });

    if (!poll) {
      throw new NotFoundException('Poll not found');
    }

    // Find and delete user's vote
    const existingVote = await this.prisma.pollVote.findFirst({
      where: {
        oderId: userId,
        option: {
          pollId: pollId,
        },
      },
    });

    if (!existingVote) {
      throw new NotFoundException('No vote found to remove');
    }

    await this.prisma.pollVote.delete({
      where: { id: existingVote.id },
    });

    // Return updated poll data
    const updatedPoll = await this.prisma.poll.findUnique({
      where: { id: pollId },
      include: {
        options: {
          orderBy: { id: 'asc' },
          include: {
            _count: {
              select: { votes: true },
            },
          },
        },
      },
    });

    const totalVotes = updatedPoll!.options.reduce((sum, opt) => sum + (opt._count?.votes || 0), 0);

    return {
      id: updatedPoll!.id,
      question: updatedPoll!.question,
      expiresAt: updatedPoll!.expiresAt,
      totalVotes,
      userVotedOptionId: null,
      options: updatedPoll!.options.map(opt => ({
        id: opt.id,
        text: opt.text,
        votes: opt._count?.votes || 0,
        percentage: totalVotes > 0 ? Math.round((opt._count?.votes || 0) / totalVotes * 100) : 0,
      })),
    };
  }

  // Delete a poll from a post
  async deletePoll(pollId: string, userId: string) {
    // Verify poll exists and get associated post
    const poll = await this.prisma.poll.findUnique({
      where: { id: pollId },
      include: { post: true },
    });

    if (!poll) {
      throw new NotFoundException('Poll not found');
    }

    // Only post author can delete the poll
    if (poll.post.authorId !== userId) {
      throw new ForbiddenException('Only the post author can delete the poll');
    }

    // Delete all votes first, then options, then the poll
    await this.prisma.pollVote.deleteMany({
      where: {
        option: {
          pollId: pollId,
        },
      },
    });

    await this.prisma.pollOption.deleteMany({
      where: { pollId: pollId },
    });

    await this.prisma.poll.delete({
      where: { id: pollId },
    });

    return { success: true, message: 'Poll deleted successfully' };
  }
}
